#!/usr/bin/env python3
"""4-tile depth-based rhythm game: step on the highlighted tile, hear the note."""

from __future__ import annotations

import argparse
import os
import random
import sys
import time
from pathlib import Path

if os.environ.get("WAYLAND_DISPLAY") and not os.environ.get("QT_QPA_PLATFORM"):
    os.environ["QT_QPA_PLATFORM"] = "xcb"

import cv2
import numpy as np
import pygame

try:
    import pyrealsense2 as rs
except ImportError as e:
    print("pyrealsense2 is not installed. Run: poetry add pyrealsense2", file=sys.stderr)
    raise SystemExit(1) from e

try:
    import sounddevice as sd
except ImportError as e:
    print("sounddevice is not installed. Run: poetry add sounddevice", file=sys.stderr)
    raise SystemExit(1) from e


SAMPLE_RATE = 44100

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import display_utils  # noqa: E402
from src.calibration import CameraCalibration, load_calibration  # noqa: E402


NOTE_NAMES = ("C4", "D4", "E4", "G4")
NOTE_FREQS = (261.63, 293.66, 329.63, 392.00)

TILE_COLORS_ACTIVE = (
    (60, 240, 255),
    (255, 230, 60),
    (255, 90, 220),
    (90, 255, 140),
)
TILE_COLOR_INACTIVE = (18, 18, 22)
TILE_BORDER = (255, 255, 255)
HIT_FLASH = (255, 255, 255)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="4-tile rhythm game (RealSense depth + projector).",
    )
    p.add_argument(
        "--calibration",
        type=Path,
        default=Path("config/calibration.json"),
        help="JSON from calibrate_apriltag.py.",
    )
    p.add_argument("-d", "--display", type=int, default=None)
    p.add_argument("--depth-width", type=int, default=640)
    p.add_argument("--depth-height", type=int, default=480)
    p.add_argument("--depth-fps", type=int, default=15)
    p.add_argument("--color-width", type=int, default=640)
    p.add_argument("--color-height", type=int, default=480)
    p.add_argument("--color-fps", type=int, default=15)
    p.add_argument(
        "--lift-mm",
        type=float,
        default=70.0,
        help="How much closer than floor model (mm) counts as foreground.",
    )
    p.add_argument(
        "--min-area",
        type=int,
        default=1500,
        help="Minimum contour area (pixels) to count as a foot/leg blob.",
    )
    p.add_argument(
        "--calib-frames",
        type=int,
        default=45,
        help="Frames to average for the empty-floor depth model.",
    )
    p.add_argument(
        "--hit-cooldown-s",
        type=float,
        default=0.45,
        help="Cooldown between hits to avoid double-trigger from one step.",
    )
    p.add_argument(
        "--volume",
        type=float,
        default=0.5,
        help="Note volume 0..1.",
    )
    return p.parse_args()


def make_note_buffer(
    freq_hz: float,
    duration_s: float = 0.45,
    sample_rate: int = SAMPLE_RATE,
    volume: float = 0.5,
) -> np.ndarray:
    n = int(sample_rate * duration_s)
    t = np.arange(n) / sample_rate
    base = np.sin(2.0 * np.pi * freq_hz * t)
    base += 0.25 * np.sin(2.0 * np.pi * (2.0 * freq_hz) * t)
    base /= 1.25

    env = np.ones(n)
    attack = max(1, int(0.01 * sample_rate))
    decay = max(1, int(0.06 * sample_rate))
    release = max(1, int(0.18 * sample_rate))
    sustain = 0.7
    env[:attack] = np.linspace(0.0, 1.0, attack)
    env[attack : attack + decay] = np.linspace(1.0, sustain, decay)
    env[-release:] = np.linspace(env[-release - 1], 0.0, release)

    wave = base * env * float(np.clip(volume, 0.0, 1.0))
    stereo = np.column_stack([wave, wave]).astype(np.float32)
    return stereo


def play_note(buffer: np.ndarray) -> None:
    try:
        sd.stop()
        sd.play(buffer, SAMPLE_RATE)
    except Exception as e:
        print(f"audio playback failed: {e}", file=sys.stderr)


def start_realsense(args: argparse.Namespace) -> tuple[rs.pipeline, rs.align, float]:
    pipe = rs.pipeline()
    cfg = rs.config()
    cfg.enable_stream(
        rs.stream.depth,
        args.depth_width,
        args.depth_height,
        rs.format.z16,
        args.depth_fps,
    )
    cfg.enable_stream(
        rs.stream.color,
        args.color_width,
        args.color_height,
        rs.format.bgr8,
        args.color_fps,
    )
    profile = pipe.start(cfg)
    dev = profile.get_device()
    depth_scale_m = float(dev.first_depth_sensor().get_depth_scale())
    align = rs.align(rs.stream.color)
    return pipe, align, depth_scale_m


def capture_floor(
    pipe: rs.pipeline,
    align: rs.align,
    depth_scale_m: float,
    n: int,
) -> np.ndarray | None:
    samples: list[np.ndarray] = []
    for _ in range(n):
        try:
            frames = pipe.wait_for_frames(timeout_ms=5000)
        except RuntimeError:
            continue
        frames = align.process(frames)
        d = frames.get_depth_frame()
        if not d:
            continue
        dmm = np.asanyarray(d.get_data()).astype(np.float32) * depth_scale_m * 1000.0
        samples.append(dmm)
    if not samples:
        return None
    stack = np.stack(samples, axis=0)
    return np.median(stack, axis=0).astype(np.float32)


def foreground_centroids(
    depth_mm: np.ndarray,
    floor_mm: np.ndarray,
    lift_mm: float,
    min_area: int,
) -> list[tuple[float, float]]:
    valid = depth_mm > 0.0
    delta = floor_mm - depth_mm
    mask = ((delta > lift_mm) & valid).astype(np.uint8) * 255
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))

    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    out: list[tuple[float, float]] = []
    for c in contours:
        area = cv2.contourArea(c)
        if area < min_area:
            continue
        m = cv2.moments(c)
        if m["m00"] <= 1e-6:
            continue
        cx = m["m10"] / m["m00"]
        cy = m["m01"] / m["m00"]
        out.append((float(cx), float(cy)))
    return out


def tile_index_from_proj(
    proj_x: float, proj_y: float, proj_w: int, proj_h: int
) -> int | None:
    if not (0.0 <= proj_x < proj_w and 0.0 <= proj_y < proj_h):
        return None
    col = 0 if proj_x < proj_w / 2.0 else 1
    row = 0 if proj_y < proj_h / 2.0 else 1
    return row * 2 + col


def pick_new_tile(current: int) -> int:
    options = [i for i in range(4) if i != current]
    return random.choice(options)


def _label_surface(
    text: str,
    font_scale: float,
    color: tuple[int, int, int],
    thickness: int,
) -> pygame.Surface:
    (tw, th), baseline = cv2.getTextSize(
        text, cv2.FONT_HERSHEY_SIMPLEX, font_scale, thickness
    )
    pad = max(4, thickness * 2)
    h_total = th + baseline + pad * 2
    w_total = tw + pad * 2
    mask = np.zeros((h_total, w_total), dtype=np.uint8)
    cv2.putText(
        mask,
        text,
        (pad, pad + th),
        cv2.FONT_HERSHEY_SIMPLEX,
        font_scale,
        255,
        thickness,
        cv2.LINE_AA,
    )
    rgba = np.zeros((h_total, w_total, 4), dtype=np.uint8)
    rgba[..., 0] = color[0]
    rgba[..., 1] = color[1]
    rgba[..., 2] = color[2]
    rgba[..., 3] = mask
    surf = pygame.image.frombuffer(rgba.tobytes(), (w_total, h_total), "RGBA")
    return surf.convert_alpha()


def _hud_surface(lines: list[str]) -> pygame.Surface:
    fs, th, pad = 0.7, 28, 12
    max_w = 0
    for line in lines:
        (tw, _), _ = cv2.getTextSize(line, cv2.FONT_HERSHEY_SIMPLEX, fs, 1)
        max_w = max(max_w, tw)
    h = pad * 2 + len(lines) * th
    w = max(440, pad * 2 + max_w + 8)
    img = np.zeros((h, w, 3), dtype=np.uint8)
    cv2.rectangle(img, (0, 0), (w - 1, h - 1), (255, 255, 255), 1)
    for i, line in enumerate(lines):
        cv2.putText(
            img,
            line,
            (pad, pad + 22 + i * th),
            cv2.FONT_HERSHEY_SIMPLEX,
            fs,
            (255, 255, 255),
            1,
            cv2.LINE_AA,
        )
    rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    return pygame.image.frombuffer(rgb.tobytes(), (w, h), "RGB").convert()


def draw_tiles(
    screen: pygame.Surface,
    scr_w: int,
    scr_h: int,
    active_idx: int,
    flash_strength: float,
) -> None:
    half_w = scr_w // 2
    half_h = scr_h // 2
    rects = [
        pygame.Rect(0, 0, half_w, half_h),
        pygame.Rect(half_w, 0, scr_w - half_w, half_h),
        pygame.Rect(0, half_h, half_w, scr_h - half_h),
        pygame.Rect(half_w, half_h, scr_w - half_w, scr_h - half_h),
    ]
    label_scale = max(2.0, min(scr_w, scr_h) / 360.0)
    label_thickness = max(2, int(label_scale * 2))
    for i, r in enumerate(rects):
        if i == active_idx:
            base = TILE_COLORS_ACTIVE[i]
            if flash_strength > 0.0:
                k = float(np.clip(flash_strength, 0.0, 1.0))
                color = tuple(
                    int(base[c] * (1.0 - k) + HIT_FLASH[c] * k) for c in range(3)
                )
            else:
                color = base
        else:
            color = TILE_COLOR_INACTIVE
        pygame.draw.rect(screen, color, r)
        pygame.draw.rect(screen, TILE_BORDER, r, width=6)
        cx, cy = r.center
        label = _label_surface(
            NOTE_NAMES[i], label_scale, TILE_BORDER, label_thickness
        )
        screen.blit(
            label,
            (cx - label.get_width() // 2, cy - label.get_height() // 2),
        )


def draw_hud(screen: pygame.Surface, scr_w: int, lines: list[str]) -> None:
    hud = _hud_surface(lines)
    screen.blit(hud, (scr_w // 2 - hud.get_width() // 2, 18))


def main() -> None:
    args = parse_args()

    cal: CameraCalibration = load_calibration(args.calibration)
    screen, scr_w, scr_h, _ = display_utils.open_fullscreen(
        args.display, "Tile rhythm game"
    )

    note_buffers = [make_note_buffer(f, volume=args.volume) for f in NOTE_FREQS]

    pipe, align, depth_scale_m = start_realsense(args)

    proj_w, proj_h = cal.proj_resolution

    state = "wait_floor"
    floor_mm: np.ndarray | None = None
    score = 0
    active_tile = random.randint(0, 3)
    last_hit_time = -1e9
    flash_until = 0.0
    fps_ema = 0.0
    last_t = time.perf_counter()

    clock = pygame.time.Clock()
    running = True
    try:
        while running:
            now = time.perf_counter()
            dt = max(1e-6, now - last_t)
            last_t = now
            inst_fps = 1.0 / dt
            fps_ema = inst_fps if fps_ema <= 0.0 else 0.9 * fps_ema + 0.1 * inst_fps

            try:
                frames = pipe.wait_for_frames(timeout_ms=5000)
            except RuntimeError:
                frames = None

            depth_mm: np.ndarray | None = None
            color_w = args.color_width
            if frames is not None:
                frames = align.process(frames)
                d = frames.get_depth_frame()
                c = frames.get_color_frame()
                if d:
                    depth_mm = (
                        np.asanyarray(d.get_data()).astype(np.float32)
                        * depth_scale_m
                        * 1000.0
                    )
                if c is not None:
                    color_w = int(np.asanyarray(c.get_data()).shape[1])

            if state == "play" and depth_mm is not None and floor_mm is not None:
                centroids = foreground_centroids(
                    depth_mm, floor_mm, args.lift_mm, args.min_area
                )
                if centroids and (now - last_hit_time) >= args.hit_cooldown_s:
                    for cx, cy in centroids:
                        px, py = cal.cam_to_proj(cx, cy, color_w)
                        idx = tile_index_from_proj(px, py, proj_w, proj_h)
                        if idx is None:
                            continue
                        if idx == active_tile:
                            play_note(note_buffers[idx])
                            score += 1
                            last_hit_time = now
                            flash_until = now + 0.18
                            active_tile = pick_new_tile(active_tile)
                            break

            screen.fill((0, 0, 0))
            flash = max(0.0, (flash_until - now) / 0.18)
            draw_tiles(screen, scr_w, scr_h, active_tile, flash)

            hud_lines = [
                f"state: {state}  score: {score}  fps: {fps_ema:.1f}",
                f"active: {NOTE_NAMES[active_tile]}  cooldown: {args.hit_cooldown_s:.2f}s",
                "SPACE: capture empty floor | R: new active tile | ESC/Q: quit",
            ]
            draw_hud(screen, scr_w, hud_lines)

            pygame.display.flip()

            for e in pygame.event.get():
                if e.type == pygame.QUIT:
                    running = False
                elif e.type == pygame.KEYDOWN:
                    if e.key in (pygame.K_ESCAPE, pygame.K_q):
                        running = False
                    elif e.key == pygame.K_SPACE and state in ("wait_floor", "play"):
                        new_floor = capture_floor(
                            pipe, align, depth_scale_m, args.calib_frames
                        )
                        if new_floor is not None:
                            floor_mm = new_floor
                            state = "play"
                    elif e.key == pygame.K_r and state == "play":
                        active_tile = pick_new_tile(active_tile)

            clock.tick(60)
    finally:
        try:
            pipe.stop()
        except Exception:
            pass
        pygame.quit()


if __name__ == "__main__":
    main()
