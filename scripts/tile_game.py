#!/usr/bin/env python3
"""4-lane treadmill rhythm game: falling tiles + depth foot hits + melody notes."""

from __future__ import annotations

import argparse
import os
import random
import sys
import time
from dataclasses import dataclass
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

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import display_utils  # noqa: E402
from src.calibration import CameraCalibration, load_calibration  # noqa: E402

SAMPLE_RATE = 44100
NOTE_FREQS = {
    "C4": 261.63,
    "D4": 293.66,
    "E4": 329.63,
    "G4": 392.00,
}
LANE_NAMES = ("LEFT", "RIGHT")

# Ready melody phrase (Hot Cross Buns), notes cycle by step.
MELODY_NOTES = [
    "E4",
    "D4",
    "C4",
    "E4",
    "D4",
    "C4",
    "C4",
    "C4",
    "D4",
    "D4",
    "E4",
    "D4",
    "C4",
]

LANE_COLORS = (
    (60, 150, 255),
    (255, 220, 60),
)
BG_COLOR = (0, 0, 0)
FG_COLOR = (255, 255, 255)


@dataclass
class FallingTile:
    lane: int
    note: str
    y: float
    h: int
    hit: bool = False


def maybe_rotate_point(x: float, y: float, w: int, h: int, rotate_180: bool) -> tuple[float, float]:
    if not rotate_180:
        return x, y
    return float(w - 1 - x), float(h - 1 - y)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="4-lane treadmill rhythm game (RealSense depth)."
    )
    p.add_argument(
        "--calibration",
        type=Path,
        default=Path("config/calibration.json"),
    )
    p.add_argument("-d", "--display", type=int, default=None)
    p.add_argument("--depth-width", type=int, default=640)
    p.add_argument("--depth-height", type=int, default=480)
    p.add_argument("--depth-fps", type=int, default=15)
    p.add_argument("--color-width", type=int, default=640)
    p.add_argument("--color-height", type=int, default=480)
    p.add_argument("--color-fps", type=int, default=15)
    p.add_argument("--lift-mm", type=float, default=70.0)
    p.add_argument("--min-area", type=int, default=1500)
    p.add_argument("--calib-frames", type=int, default=45)
    p.add_argument("--hit-cooldown-s", type=float, default=0.25)
    p.add_argument("--proj-bias-y", type=float, default=60.0)
    p.add_argument(
        "--treadmill-speed-mps",
        type=float,
        default=None,
        help="Treadmill speed in m/s. If omitted, computed from step-length/step-time.",
    )
    p.add_argument(
        "--step-length-cm",
        type=float,
        default=72.0,
        help="Average step length in cm (used for tile gap planning).",
    )
    p.add_argument(
        "--step-time-s",
        type=float,
        default=0.5,
        help="Average time per step in seconds (spawn interval).",
    )
    p.add_argument("--volume", type=float, default=0.45)
    return p.parse_args()


def make_note_buffer(freq_hz: float, duration_s: float = 0.35, volume: float = 0.45) -> np.ndarray:
    n = int(SAMPLE_RATE * duration_s)
    t = np.arange(n) / SAMPLE_RATE
    base = np.sin(2.0 * np.pi * freq_hz * t)
    base += 0.2 * np.sin(2.0 * np.pi * (2.0 * freq_hz) * t)
    base /= 1.2

    env = np.ones(n)
    a = max(1, int(0.01 * SAMPLE_RATE))
    d = max(1, int(0.05 * SAMPLE_RATE))
    r = max(1, int(0.14 * SAMPLE_RATE))
    sustain = 0.7
    env[:a] = np.linspace(0.0, 1.0, a)
    env[a : a + d] = np.linspace(1.0, sustain, d)
    env[-r:] = np.linspace(env[-r - 1], 0.0, r)

    mono = base * env * float(np.clip(volume, 0.0, 1.0))
    stereo = np.column_stack([mono, mono]).astype(np.float32)
    return stereo


def play_note(buf: np.ndarray) -> None:
    try:
        sd.stop()
        sd.play(buf, SAMPLE_RATE)
    except Exception as e:
        print(f"audio playback failed: {e}", file=sys.stderr)


def start_realsense(args: argparse.Namespace) -> tuple[rs.pipeline, rs.align, float]:
    pipe = rs.pipeline()
    cfg = rs.config()
    cfg.enable_stream(rs.stream.depth, args.depth_width, args.depth_height, rs.format.z16, args.depth_fps)
    cfg.enable_stream(rs.stream.color, args.color_width, args.color_height, rs.format.bgr8, args.color_fps)
    profile = pipe.start(cfg)
    dev = profile.get_device()
    depth_scale_m = float(dev.first_depth_sensor().get_depth_scale())
    align = rs.align(rs.stream.color)
    return pipe, align, depth_scale_m


def capture_floor(pipe: rs.pipeline, align: rs.align, depth_scale_m: float, n: int) -> np.ndarray | None:
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
        depth_mm = np.asanyarray(d.get_data()).astype(np.float32) * depth_scale_m * 1000.0
        samples.append(depth_mm)
    if not samples:
        return None
    return np.median(np.stack(samples, axis=0), axis=0).astype(np.float32)


def detect_foot_points(depth_mm: np.ndarray, floor_mm: np.ndarray, lift_mm: float, min_area: int) -> list[tuple[float, float]]:
    valid = depth_mm > 0.0
    delta = floor_mm - depth_mm
    mask = ((delta > lift_mm) & valid).astype(np.uint8) * 255
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))

    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    points: list[tuple[float, float]] = []
    for c in contours:
        if cv2.contourArea(c) < min_area:
            continue
        pts = c.reshape(-1, 2)
        if pts.shape[0] == 0:
            continue
        max_y = int(np.max(pts[:, 1]))
        band = pts[pts[:, 1] >= (max_y - 6)]
        if band.shape[0] == 0:
            band = pts
        x = float(np.median(band[:, 0]))
        y = float(max_y)
        points.append((x, y))
    return points


def _label_surface(text: str, scale: float, color: tuple[int, int, int], thickness: int) -> pygame.Surface:
    (tw, th), baseline = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, scale, thickness)
    pad = max(4, thickness * 2)
    h = th + baseline + pad * 2
    w = tw + pad * 2
    alpha = np.zeros((h, w), dtype=np.uint8)
    cv2.putText(alpha, text, (pad, pad + th), cv2.FONT_HERSHEY_SIMPLEX, scale, 255, thickness, cv2.LINE_AA)
    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    rgba[..., 0] = color[0]
    rgba[..., 1] = color[1]
    rgba[..., 2] = color[2]
    rgba[..., 3] = alpha
    surf = pygame.image.frombuffer(rgba.tobytes(), (w, h), "RGBA")
    return surf.convert_alpha()


def _hud_surface(lines: list[str]) -> pygame.Surface:
    fs, th, pad = 0.65, 26, 12
    max_w = 0
    for line in lines:
        (tw, _), _ = cv2.getTextSize(line, cv2.FONT_HERSHEY_SIMPLEX, fs, 1)
        max_w = max(max_w, tw)
    h = pad * 2 + len(lines) * th
    w = max(520, pad * 2 + max_w + 8)
    img = np.zeros((h, w, 3), dtype=np.uint8)
    cv2.rectangle(img, (0, 0), (w - 1, h - 1), FG_COLOR, 1)
    for i, line in enumerate(lines):
        cv2.putText(
            img,
            line,
            (pad, pad + 20 + i * th),
            cv2.FONT_HERSHEY_SIMPLEX,
            fs,
            FG_COLOR,
            1,
            cv2.LINE_AA,
        )
    rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    return pygame.image.frombuffer(rgb.tobytes(), (w, h), "RGB").convert()


def lane_rects(scr_w: int, play_top: int, play_bottom: int) -> list[pygame.Rect]:
    play_h = play_bottom - play_top
    lane_w = scr_w // 2
    rects = []
    for i in range(2):
        x0 = i * lane_w
        w = lane_w if i < 1 else (scr_w - x0)
        rects.append(pygame.Rect(x0, play_top, w, play_h))
    return rects


def draw_scene(
    screen: pygame.Surface,
    scr_w: int,
    play_top: int,
    play_bottom: int,
    hit_y: int,
    hit_window: int,
    tiles: list[FallingTile],
) -> None:
    screen.fill(BG_COLOR)
    rects = lane_rects(scr_w, play_top, play_bottom)
    for i, r in enumerate(rects):
        pygame.draw.rect(screen, (20, 20, 24), r)
        pygame.draw.rect(screen, FG_COLOR, r, width=2)
        tag = _label_surface(LANE_NAMES[i], 1.2, FG_COLOR, 2)
        screen.blit(tag, (r.centerx - tag.get_width() // 2, play_top + 8))

    pygame.draw.line(screen, (255, 255, 255), (0, hit_y), (scr_w, hit_y), 4)
    pygame.draw.line(screen, (100, 100, 100), (0, hit_y - hit_window), (scr_w, hit_y - hit_window), 1)
    pygame.draw.line(screen, (100, 100, 100), (0, hit_y + hit_window), (scr_w, hit_y + hit_window), 1)

    for tile in tiles:
        r_lane = rects[tile.lane]
        pad_x = max(8, r_lane.width // 12)
        t_rect = pygame.Rect(r_lane.left + pad_x, int(tile.y), r_lane.width - 2 * pad_x, tile.h)
        if t_rect.bottom < play_top or t_rect.top > play_bottom:
            continue
        color = LANE_COLORS[tile.lane]
        if tile.hit:
            color = (255, 255, 255)
        pygame.draw.rect(screen, color, t_rect, border_radius=10)
        pygame.draw.rect(screen, FG_COLOR, t_rect, width=3, border_radius=10)
        txt = _label_surface(tile.note, 0.9, FG_COLOR, 2)
        screen.blit(txt, (t_rect.centerx - txt.get_width() // 2, t_rect.centery - txt.get_height() // 2))


def screen_lane_of_point(x: float, y: float, rects: list[pygame.Rect], hit_y: int, hit_window: int) -> int | None:
    if not (hit_y - hit_window <= y <= hit_y + hit_window):
        return None
    for i, r in enumerate(rects):
        if r.left <= x < r.right:
            return i
    return None


def main() -> None:
    args = parse_args()
    rotate_180 = True

    cal: CameraCalibration = load_calibration(args.calibration)
    screen, scr_w, scr_h, _ = display_utils.open_fullscreen(args.display, "Treadmill tile rhythm")

    note_buffers = {name: make_note_buffer(freq, volume=args.volume) for name, freq in NOTE_FREQS.items()}

    pipe, align, depth_scale_m = start_realsense(args)

    proj_w, proj_h = cal.proj_resolution
    sx = scr_w / float(proj_w)
    sy = scr_h / float(proj_h)

    state = "wait_floor"
    floor_mm: np.ndarray | None = None
    score = 0
    misses = 0

    play_top = int(scr_h * 0.16)
    play_bottom = scr_h - 8
    play_h = play_bottom - play_top
    hit_y = int(play_top + play_h * 0.82)
    hit_window = max(18, int(play_h * 0.05))

    step_length_m = float(np.clip(args.step_length_cm / 100.0, 0.35, 1.2))
    step_time_s = float(np.clip(args.step_time_s, 0.35, 1.2))
    speed_mps = (
        float(args.treadmill_speed_mps)
        if args.treadmill_speed_mps is not None
        else (step_length_m / step_time_s)
    )
    tile_speed_px_s = float(np.clip(speed_mps * 420.0, 80.0, 620.0))
    gap_px_target = tile_speed_px_s * step_time_s
    # Make tiles feel like a full step (taller, easier to hit).
    tile_h = int(np.clip(gap_px_target*1.2, play_h * 0.22, play_h * 0.45))

    tiles: list[FallingTile] = []
    melody_idx = 0
    next_lane = 0
    next_spawn_t = time.perf_counter() + 1.0
    last_hit_t = -1e9

    fps_ema = 0.0
    t_prev = time.perf_counter()
    clock = pygame.time.Clock()
    running = True

    try:
        while running:
            now = time.perf_counter()
            dt = max(1e-6, now - t_prev)
            t_prev = now
            fps = 1.0 / dt
            fps_ema = fps if fps_ema <= 0.0 else (0.9 * fps_ema + 0.1 * fps)

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
                    depth_mm = np.asanyarray(d.get_data()).astype(np.float32) * depth_scale_m * 1000.0
                if c is not None:
                    color_w = int(np.asanyarray(c.get_data()).shape[1])

            rects = lane_rects(scr_w, play_top, play_bottom)
            pressed_lanes: set[int] = set()
            if state == "play" and depth_mm is not None and floor_mm is not None:
                for cx, cy in detect_foot_points(depth_mm, floor_mm, args.lift_mm, args.min_area):
                    px, py = cal.cam_to_proj(cx, cy, color_w)
                    sxp = px * sx
                    syp = py * sy + args.proj_bias_y
                    sxp, syp = maybe_rotate_point(sxp, syp, scr_w, scr_h, rotate_180)
                    lane = screen_lane_of_point(sxp, syp, rects, hit_y, hit_window)
                    if lane is not None:
                        pressed_lanes.add(lane)

            if state == "play":
                while now >= next_spawn_t:
                    note = MELODY_NOTES[melody_idx]
                    melody_idx = (melody_idx + 1) % len(MELODY_NOTES)
                    lane = next_lane
                    next_lane = 1 - next_lane
                    tiles.append(FallingTile(lane=lane, note=note, y=float(play_top - tile_h), h=tile_h))
                    next_spawn_t += step_time_s

                for tile in tiles:
                    if not tile.hit:
                        tile.y += tile_speed_px_s * dt

                if (now - last_hit_t) >= args.hit_cooldown_s and pressed_lanes:
                    for lane in sorted(pressed_lanes):
                        candidates = [
                            t for t in tiles
                            if (not t.hit)
                            and t.lane == lane
                            and abs((t.y + t.h * 0.5) - hit_y) <= hit_window
                        ]
                        if not candidates:
                            continue
                        chosen = min(candidates, key=lambda t: abs((t.y + t.h * 0.5) - hit_y))
                        chosen.hit = True
                        score += 1
                        last_hit_t = now
                        play_note(note_buffers[chosen.note])
                        break

                kept: list[FallingTile] = []
                for t in tiles:
                    if t.hit:
                        # remove hit tiles after short flash.
                        if (now - last_hit_t) < 0.12:
                            kept.append(t)
                        continue
                    if t.y > (play_bottom + t.h):
                        misses += 1
                        continue
                    kept.append(t)
                tiles = kept

            frame = pygame.Surface((scr_w, scr_h))
            draw_scene(frame, scr_w, play_top, play_bottom, hit_y, hit_window, tiles)
            hud_lines = [
                f"state: {state}  score: {score}  miss: {misses}  fps: {fps_ema:.1f}",
                f"speed: {tile_speed_px_s:.0f}px/s (~{speed_mps:.2f} m/s)  step: {step_length_m*100:.0f}cm / {step_time_s:.2f}s",
                f"lift-mm: {args.lift_mm:.0f}  bias-y: {args.proj_bias_y:.0f}  cooldown: {args.hit_cooldown_s:.2f}s",
                "SPACE: capture empty floor | R: reset score | ESC/Q: quit",
            ]
            hud = _hud_surface(hud_lines)
            frame.blit(hud, (scr_w // 2 - hud.get_width() // 2, 12))
            if rotate_180:
                frame = pygame.transform.rotate(frame, 180)
            screen.blit(frame, (0, 0))
            pygame.display.flip()

            for e in pygame.event.get():
                if e.type == pygame.QUIT:
                    running = False
                elif e.type == pygame.KEYDOWN:
                    if e.key in (pygame.K_ESCAPE, pygame.K_q):
                        running = False
                    elif e.key == pygame.K_SPACE:
                        new_floor = capture_floor(pipe, align, depth_scale_m, args.calib_frames)
                        if new_floor is not None:
                            floor_mm = new_floor
                            state = "play"
                            tiles.clear()
                            melody_idx = 0
                            next_lane = 0
                            next_spawn_t = time.perf_counter() + 0.8
                    elif e.key == pygame.K_r:
                        score = 0
                        misses = 0

            clock.tick(60)
    finally:
        try:
            pipe.stop()
        except Exception:
            pass
        pygame.quit()


if __name__ == "__main__":
    main()
