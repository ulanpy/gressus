#!/usr/bin/env python3
"""Two-lane treadmill game: falling tiles + depth foot hits; looped BGM + SFX on hit."""

from __future__ import annotations

import argparse
import os
import sys
import time
from pathlib import Path

if os.environ.get("WAYLAND_DISPLAY") and not os.environ.get("QT_QPA_PLATFORM"):
    os.environ["QT_QPA_PLATFORM"] = "xcb"

import numpy as np
import pygame

try:
    import pyrealsense2 as rs
except ImportError as e:
    print("pyrealsense2 is not installed. Run: poetry add pyrealsense2", file=sys.stderr)
    raise SystemExit(1) from e

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import display_utils  # noqa: E402
from src.calibration import CameraCalibration, load_calibration  # noqa: E402
from src.game.audio import GameAudio, default_assets_dir  # noqa: E402
from src.game.hit_logic import (  # noqa: E402
    lane_ready_for_tile,
    point_inside_tile_y,
    screen_lane_of_point,
    tile_overlaps_hit_zone,
)
from src.game.insole_gate import insole_allows_lane, insole_hud_line  # noqa: E402
from src.game.models import FallingTile  # noqa: E402
from src.game.realsense_depth import capture_floor, detect_foot_points, start_realsense  # noqa: E402
from src.game.render import draw_scene, hud_surface, lane_rects  # noqa: E402
from src.insole_stream import InsoleTcpReceiver  # noqa: E402

LANE_NAMES = ("LEFT", "RIGHT")
TILE_LABEL = "\u2605"  # star on tile (audio is asset SFX, not note names)
LANE_COLORS = ((60, 150, 255), (255, 220, 60))
BG_COLOR = (0, 0, 0)
FG_COLOR = (255, 255, 255)


def maybe_rotate_point(x: float, y: float, w: int, h: int, rotate_180: bool) -> tuple[float, float]:
    if not rotate_180:
        return x, y
    return float(w - 1 - x), float(h - 1 - y)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="4-lane treadmill rhythm game (RealSense depth).")
    p.add_argument("--calibration", type=Path, default=Path("config/calibration.json"))
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
    p.add_argument("--hit-window-frac", type=float, default=0.09)
    p.add_argument("--proj-bias-y", type=float, default=60.0)
    p.add_argument("--no-insole", action="store_true", help="Disable Insolex pressure confirmation.")
    p.add_argument("--insole-host", default="0.0.0.0", help="TCP host for the Windows WaveX bridge.")
    p.add_argument("--insole-port", type=int, default=9100, help="TCP port for the Windows WaveX bridge.")
    p.add_argument("--insole-thresh-kpa", type=float, default=8.0, help="Max pressure needed to confirm a step.")
    p.add_argument("--swap-insole-lanes", action="store_true")
    p.add_argument("--insole-max-age-s", type=float, default=0.75)
    p.add_argument(
        "-S",
        "--speed",
        "--treadmill-speed-mps",
        type=float,
        default=0.22,
        metavar="MPS",
        dest="treadmill_speed_mps",
        help="Скорость падения плиток (условные м/с вдоль «ленты»). Равносильно -S / --speed / --treadmill-speed-mps.",
    )
    p.add_argument("--step-time-s", type=float, default=1.45)
    p.add_argument("--tile-height-frac", type=float, default=0.42)
    p.add_argument("--same-lane-gap-frac", type=float, default=0.08)
    p.add_argument(
        "--assets-dir",
        type=Path,
        default=None,
        help="Folder with BGM + hit WAV (default: <repo>/assets).",
    )
    p.add_argument("--music-volume", type=float, default=0.32, help="Looped BGM volume 0..1.")
    p.add_argument("--sfx-volume", type=float, default=0.85, help="Hit sound volume 0..1.")
    return p.parse_args()


def main() -> None:
    args = parse_args()
    rotate_180 = True

    cal: CameraCalibration = load_calibration(args.calibration)
    screen, scr_w, scr_h, _ = display_utils.open_fullscreen(args.display, "Treadmill tile rhythm")
    assets_dir = args.assets_dir if args.assets_dir is not None else default_assets_dir()
    game_audio = GameAudio(
        assets_dir=assets_dir,
        music_volume=args.music_volume,
        sfx_volume=args.sfx_volume,
    )

    insole_rx: InsoleTcpReceiver | None = None
    try:
        if not args.no_insole:
            insole_rx = InsoleTcpReceiver(args.insole_host, args.insole_port)
            insole_rx.start()

        pipe, align, depth_scale_m = start_realsense(
            rs,
            depth_width=args.depth_width,
            depth_height=args.depth_height,
            depth_fps=args.depth_fps,
            color_width=args.color_width,
            color_height=args.color_height,
            color_fps=args.color_fps,
        )
    except Exception:
        game_audio.stop()
        if insole_rx is not None:
            insole_rx.stop()
        raise

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
    hit_window = max(18, int(play_h * float(np.clip(args.hit_window_frac, 0.03, 0.20))))

    step_time_s = float(np.clip(args.step_time_s, 0.75, 2.8))
    speed_mps = float(np.clip(args.treadmill_speed_mps, 0.05, 1.5))
    tile_speed_px_s = float(np.clip(speed_mps * 420.0, 45.0, 620.0))
    step_pitch_px = tile_speed_px_s * step_time_s
    tile_height_frac = float(np.clip(args.tile_height_frac, 0.18, 0.48))
    tile_h = int(np.clip(play_h * tile_height_frac, play_h * 0.18, play_h * 0.48))
    same_lane_gap_px = int(play_h * float(np.clip(args.same_lane_gap_frac, 0.02, 0.25)))

    tiles: list[FallingTile] = []
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
            insole_snapshot = None if insole_rx is None else insole_rx.latest_snapshot(args.insole_thresh_kpa)

            try:
                frames = pipe.wait_for_frames(timeout_ms=5000)
            except RuntimeError:
                frames = None

            depth_mm: np.ndarray | None = None
            color_w = args.color_width
            color_h = args.color_height
            if frames is not None:
                frames = align.process(frames)
                d = frames.get_depth_frame()
                c = frames.get_color_frame()
                if d:
                    depth_mm = np.asanyarray(d.get_data()).astype(np.float32) * depth_scale_m * 1000.0
                if c is not None:
                    color_img = np.asanyarray(c.get_data())
                    color_h, color_w = int(color_img.shape[0]), int(color_img.shape[1])

            rects = lane_rects(scr_w, play_top, play_bottom)
            lane_bounds = [(float(r.left), float(r.right)) for r in rects]
            foot_points = 0
            projected_points: list[tuple[float, float, int | None, bool]] = []
            lane_points: dict[int, list[tuple[float, float]]] = {0: [], 1: []}
            if state == "play" and depth_mm is not None and floor_mm is not None:
                for cx, cy in detect_foot_points(depth_mm, floor_mm, args.lift_mm, args.min_area):
                    foot_points += 1
                    px, py = cal.cam_to_proj(cx, cy, color_w)
                    sxp = px * sx
                    syp = py * sy + args.proj_bias_y
                    sxp, syp = maybe_rotate_point(sxp, syp, scr_w, scr_h, rotate_180)
                    lane = screen_lane_of_point(sxp, lane_bounds)
                    in_hit_band = hit_y - hit_window <= syp <= hit_y + hit_window
                    projected_points.append((sxp, syp, lane, in_hit_band))
                    if lane is not None:
                        lane_points[lane].append((sxp, syp))

            if state == "play":
                while now >= next_spawn_t:
                    lane = next_lane
                    if not lane_ready_for_tile(lane, tiles, play_top, tile_h, same_lane_gap_px):
                        next_spawn_t = now + 0.05
                        break
                    next_lane = 1 - next_lane
                    tiles.append(
                        FallingTile(lane=lane, note=TILE_LABEL, y=float(play_top - tile_h), h=tile_h)
                    )
                    next_spawn_t += step_time_s

                for tile in tiles:
                    if not tile.hit:
                        tile.y += tile_speed_px_s * dt

                pressure_lanes = {
                    lane
                    for lane, points in lane_points.items()
                    if points
                    and insole_allows_lane(
                        lane,
                        insole_snapshot,
                        args.insole_max_age_s,
                        swap_lanes=args.swap_insole_lanes,
                    )
                }
                if (now - last_hit_t) >= args.hit_cooldown_s and pressure_lanes:
                    for lane in sorted(pressure_lanes):
                        candidates = [
                            t
                            for t in tiles
                            if (not t.hit)
                            and t.lane == lane
                            and (
                                any(point_inside_tile_y(py, t) for _px, py in lane_points[lane])
                                or tile_overlaps_hit_zone(t, hit_y, hit_window)
                            )
                        ]
                        if not candidates:
                            continue
                        chosen = min(candidates, key=lambda t: abs((t.y + t.h * 0.5) - hit_y))
                        chosen.hit = True
                        score += 1
                        last_hit_t = now
                        game_audio.play_hit()
                        break

                kept: list[FallingTile] = []
                for t in tiles:
                    if t.hit:
                        if (now - last_hit_t) < 0.12:
                            kept.append(t)
                        continue
                    if t.y > (play_bottom + t.h):
                        misses += 1
                        continue
                    kept.append(t)
                tiles = kept

            frame = pygame.Surface((scr_w, scr_h))
            draw_scene(
                frame,
                scr_w=scr_w,
                play_top=play_top,
                play_bottom=play_bottom,
                hit_y=hit_y,
                hit_window=hit_window,
                tiles=tiles,
                lane_names=LANE_NAMES,
                lane_colors=LANE_COLORS,
                bg_color=BG_COLOR,
                fg_color=FG_COLOR,
            )

            depth_lanes = {lane for lane, points in lane_points.items() if points}
            gated_lanes = {
                lane
                for lane in depth_lanes
                if insole_allows_lane(
                    lane,
                    insole_snapshot,
                    args.insole_max_age_s,
                    swap_lanes=args.swap_insole_lanes,
                )
            }
            for sxp, syp, lane, in_hit_band in projected_points:
                on_tile = lane is not None and any(
                    (not t.hit) and t.lane == lane and point_inside_tile_y(syp, t)
                    for t in tiles
                )
                col = (80, 255, 120) if lane is not None and (in_hit_band or on_tile) else (255, 90, 90)
                pygame.draw.circle(frame, col, (int(sxp), int(syp)), 14, width=4)

            hud_lines = [
                f"state: {state}  score: {score}  miss: {misses}  fps: {fps_ema:.1f}",
                f"speed: {tile_speed_px_s:.0f}px/s (~{speed_mps:.2f} m/s)  step interval: {step_time_s:.2f}s",
                f"step pitch: {step_pitch_px:.0f}px  tile-h: {tile_h}px ({tile_height_frac:.0%})  same-lane gap: {same_lane_gap_px}px",
                f"hit-window: ±{hit_window}px  cooldown: {args.hit_cooldown_s:.2f}s",
                f"depth feet: {foot_points}  depth lanes: {sorted(depth_lanes)}  gated lanes: {sorted(gated_lanes)}",
                f"camera: {color_w}x{color_h}  calib: {cal.raw.get('camera_resolution', '?')}",
                f"lift-mm: {args.lift_mm:.0f}  min-area: {args.min_area}  bias-y: {args.proj_bias_y:.0f}",
                f"insole lane map: {'swapped R/L' if args.swap_insole_lanes else 'normal L/R'}",
                insole_hud_line(insole_snapshot, args.insole_thresh_kpa, args.insole_max_age_s),
                "SPACE: capture empty floor | R: reset score | ESC/Q: quit",
            ]
            hud = hud_surface(hud_lines, fg_color=FG_COLOR)
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
                            next_lane = 0
                            next_spawn_t = time.perf_counter() + 0.8
                    elif e.key == pygame.K_r:
                        score = 0
                        misses = 0

            clock.tick(60)
    finally:
        game_audio.stop()
        try:
            pipe.stop()
        except Exception:
            pass
        if insole_rx is not None:
            insole_rx.stop()
        pygame.quit()


if __name__ == "__main__":
    main()
