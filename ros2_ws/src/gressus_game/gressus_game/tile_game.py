"""Two-lane treadmill tile game loop (ROS topic feeds)."""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from collections.abc import Callable
from pathlib import Path

import cv2
import numpy as np
import pygame

from gressus_common.insole_types import InsoleSnapshot
from gressus_game.audio import GameAudio, default_assets_dir
from gressus_game.calibration import CameraCalibration, load_calibration
from gressus_game.display import open_fullscreen
from gressus_game.insole_gate import insole_hud_line
from gressus_game.models import FallingTile
from gressus_game.paths import CALIBRATION_JSON
from gressus_game.render import draw_scene, hud_surface, lane_rects
from gressus_game.sources import CameraFeed, InsoleFeed
from gressus_realsense.realsense_depth import tile_signals

LANE_NAMES = ("LEFT", "RIGHT")
LANE_COLORS = ((48, 210, 255), (246, 88, 220))
BG_COLOR = (6, 12, 32)
FG_COLOR = (255, 255, 255)

LIFT_MM_MIN = 18.0
LIFT_MM_MAX = 250.0
DEPTH_FILL_THRESH = 0.15
RGB_FILL_THRESH = 0.20
RGB_LIT_DELTA = 22
# Temporary hit-gate debug: "both" | "depth" | "rgb"
HIT_GATE_DEBUG = "both"
HIT_COOLDOWN_S = 0.18
INSOLE_MAX_AGE_S = 0.40
GAME_MODES = ("full", "camera", "demo")

TILE_HEIGHT_FRAC = 0.42
FLOOR_CAPTURE_FRAMES = 45


def output_canvas_size(scr_w: int, scr_h: int, rot: int) -> tuple[int, int]:
    return (scr_h, scr_w) if rot in (90, 270) else (scr_w, scr_h)


def tile_cam_poly(
    tile: FallingTile,
    lane_rect: pygame.Rect,
    *,
    H_canvas_to_cam: np.ndarray,
    shift_x: int,
    shift_y: int,
    play_top: int,
    play_bottom: int,
) -> np.ndarray | None:
    """Map the VISIBLE part of a tile (canvas pixels) into camera pixels.

    Calibration solves canvas <-> camera directly. We MUST clip the tile's
    canvas Y range to the play area (= the calibrated projection rectangle)
    before applying the homography — extrapolating outside the calibrated
    quad gives arbitrary camera coords (including off-frame regions that may
    overlap the patient's body), which would auto-trigger hits while the
    tile is still spawning above the canvas.

    Returns None when the tile has no visible portion inside the play band.
    """
    pad_x = max(8, lane_rect.width // 12)
    l = lane_rect.left + pad_x + shift_x
    r = lane_rect.right - pad_x + shift_x
    raw_t = int(tile.y) + shift_y
    raw_b = int(tile.y + tile.h) + shift_y
    t = max(raw_t, play_top)
    b = min(raw_b, play_bottom)
    if b - t < 2:
        return None
    canvas_pts = np.array(
        [(l, t), (r, t), (r, b), (l, b)], dtype=np.float32,
    )
    cam_pts = cv2.perspectiveTransform(
        canvas_pts.reshape(-1, 1, 2), H_canvas_to_cam,
    ).reshape(-1, 2)
    return cam_pts


def tile_overlaps_play(t: FallingTile, play_top: int, play_bottom: int) -> bool:
    """True when any part of the tile is inside the play band."""
    return (t.y + t.h) >= play_top and t.y <= play_bottom


def foot_hit_ok(d: float, r: float) -> bool:
    if HIT_GATE_DEBUG == "depth":
        return d >= DEPTH_FILL_THRESH
    if HIT_GATE_DEBUG == "rgb":
        return r >= RGB_FILL_THRESH
    return d >= DEPTH_FILL_THRESH and r >= RGB_FILL_THRESH


def hit_need_label() -> str:
    if HIT_GATE_DEBUG == "depth":
        return f"need D≥{DEPTH_FILL_THRESH:.0%} (R gate off) AND P"
    if HIT_GATE_DEBUG == "rgb":
        return f"need R≥{RGB_FILL_THRESH:.0%} (D gate off) AND P"
    return (
        f"need D≥{DEPTH_FILL_THRESH:.0%} R≥{RGB_FILL_THRESH:.0%} "
        f"(hit=D AND R AND P)"
    )


def pressure_ok(
    lane: int,
    snapshot: InsoleSnapshot | None,
    insole_enabled: bool,
) -> bool:
    if not insole_enabled:
        return True
    if snapshot is None or not snapshot.has_recent_data:
        return False
    if snapshot.age_s is None or snapshot.age_s > INSOLE_MAX_AGE_S:
        return False
    stats = snapshot.left_stats if lane == 0 else snapshot.right_stats
    return stats.has_data and stats.pressed


def load_shift(cal_path: Path) -> tuple[int, int]:
    try:
        with open(cal_path, encoding="utf-8") as f:
            raw = json.load(f)
        v = raw.get("hit_shift_canvas")
        if isinstance(v, (list, tuple)) and len(v) == 2:
            return int(v[0]), int(v[1])
    except Exception:
        pass
    return 0, 0


def save_shift(cal_path: Path, shift: tuple[int, int]) -> None:
    with open(cal_path, encoding="utf-8") as f:
        raw = json.load(f)
    raw["hit_shift_canvas"] = [int(shift[0]), int(shift[1])]
    with open(cal_path, "w", encoding="utf-8") as f:
        json.dump(raw, f, indent=2, ensure_ascii=False)


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="2-lane treadmill tile game (ROS feeds).")
    p.add_argument("-d", "--display", type=int, default=None)
    p.add_argument("--output-rotation", type=int, choices=(0, 90, 180, 270), default=270)
    p.add_argument(
        "--mode",
        choices=GAME_MODES,
        default="full",
        help="full: camera + insoles; camera: camera only; demo: no sensors.",
    )
    p.add_argument("--insole-thresh-kpa", type=float, default=8.0)
    p.add_argument(
        "-S",
        "--speed",
        "--treadmill-speed-mps",
        type=float,
        default=0.22,
        metavar="MPS",
        dest="tile_speed_mps",
    )
    p.add_argument("--step-time-s", type=float, default=0.4)
    return p.parse_args(argv)


def run_tile_game(
    args: argparse.Namespace,
    *,
    insole_feed: InsoleFeed | None = None,
    camera_feed: CameraFeed | None = None,
    log_info: Callable[[str], None] | None = None,
    log_warn: Callable[[str], None] | None = None,
) -> None:
    if os.environ.get("WAYLAND_DISPLAY") and not os.environ.get("QT_QPA_PLATFORM"):
        os.environ["QT_QPA_PLATFORM"] = "xcb"

    demo_mode = args.mode == "demo"
    camera_enabled = args.mode in {"full", "camera"}
    insole_enabled = args.mode == "full"

    if camera_enabled and camera_feed is None:
        raise RuntimeError("camera_feed is required for --mode full or --mode camera")

    cal: CameraCalibration | None = None
    if camera_enabled:
        cal = load_calibration(CALIBRATION_JSON)
        if args.output_rotation != cal.output_rotation:
            raise RuntimeError(
                f"output_rotation mismatch: requested {args.output_rotation}°, "
                f"calibration was recorded at {cal.output_rotation}°. "
                f"Either start the game with --output-rotation {cal.output_rotation}, "
                f"or re-run calibration with --output-rotation {args.output_rotation}."
            )
    rot = args.output_rotation

    screen, scr_w, scr_h, _ = open_fullscreen(args.display, "Treadmill tile rhythm")
    cw, ch = output_canvas_size(scr_w, scr_h, rot)
    if cal is not None:
        cal_cw, cal_ch = cal.canvas_resolution
        if (cw, ch) != (cal_cw, cal_ch):
            raise RuntimeError(
                f"canvas size {cw}x{ch} (screen {scr_w}x{scr_h} rot={rot}) does not match "
                f"calibration canvas {cal_cw}x{cal_ch}. Re-run calibration on the same display."
            )
    audio = GameAudio(assets_dir=default_assets_dir())

    state = "play" if demo_mode else "wait_floor"
    floor_mm: np.ndarray | None = None
    baseline_gray: np.ndarray | None = None
    score = 0
    misses = 0
    combo_count = 0
    combo_burst_t = -1e9

    play_top = int(ch * 0.16)
    play_bottom = ch - 8
    play_h = play_bottom - play_top
    hit_y = int(play_top + play_h * 0.82)
    hit_window = max(60, int(play_h * 0.15))
    # hit_y sits below play_bottom when tile center aligns — keep overlap checks loose.

    tile_speed_mps = float(np.clip(args.tile_speed_mps, 0.05, 1.5))
    tile_speed_px_s = float(np.clip(tile_speed_mps * 420.0, 45.0, 620.0))
    step_time_s = float(np.clip(args.step_time_s, 0.2, 2.8))
    tile_h = int(play_h * TILE_HEIGHT_FRAC)
    tiles: list[FallingTile] = []
    tile_d: dict[int, float] = {}
    tile_r: dict[int, float] = {}
    tile_p: dict[int, bool] = {}
    tile_area: dict[int, int] = {}
    next_lane = 0
    next_spawn_t = time.perf_counter() + 1.0
    last_hit_t = -1e9

    shift_x, shift_y = load_shift(CALIBRATION_JSON)
    shift_dirty = False
    shift_saved_msg_t = -1e9
    session_intro_played = False
    floor_capture_msg_t = -1e9

    fps_ema = 0.0
    t_prev = time.perf_counter()
    clock = pygame.time.Clock()
    running = True
    show_debug_hud = False
    last_gate_log_t = -1e9
    last_gate_key = ""
    last_no_depth_log_t = -1e9
    last_cam_stats_log_t = -1e9

    def _info(msg: str) -> None:
        if log_info is not None:
            log_info(msg)

    def _warn(msg: str) -> None:
        if log_warn is not None:
            log_warn(msg)

    try:
        while running:
            now = time.perf_counter()
            dt = max(1e-6, now - t_prev)
            t_prev = now
            fps_ema = 1.0 / dt if fps_ema <= 0.0 else 0.9 * fps_ema + 0.1 / dt

            insole_snap = (
                insole_feed.latest(args.insole_thresh_kpa)
                if insole_feed is not None
                else None
            )

            depth_mm: np.ndarray | None = None
            color_gray: np.ndarray | None = None
            if camera_feed is not None:
                depth_mm, color_gray = camera_feed.latest()
                if log_info is not None and (now - last_cam_stats_log_t) >= 5.0:
                    stats = (
                        camera_feed.stats_line()
                        if hasattr(camera_feed, "stats_line")
                        else "camera feed active"
                    )
                    _info(f"camera {stats} state={state}")
                    last_cam_stats_log_t = now

            rects = lane_rects(cw, play_top, play_bottom)
            tile_d.clear()
            tile_r.clear()
            tile_p.clear()
            tile_area.clear()

            if state == "play":
                if not session_intro_played:
                    audio.play_intro_start()
                    session_intro_played = True

                while now >= next_spawn_t:
                    tiles.append(
                        FallingTile(
                            lane=next_lane,
                            note="",
                            y=float(play_top - tile_h),
                            h=tile_h,
                            spawn_t=next_spawn_t,
                        )
                    )
                    next_lane = 1 - next_lane
                    next_spawn_t += step_time_s

                for t in tiles:
                    if not t.hit:
                        t.y += tile_speed_px_s * dt

                if demo_mode:
                    for i, t in enumerate(tiles):
                        if t.hit:
                            continue
                        if not tile_overlaps_play(t, play_top, play_bottom):
                            continue
                        tile_center_y = t.y + t.h * 0.5
                        ready = abs(tile_center_y - hit_y) <= hit_window * 0.5
                        tile_d[i] = 1.0 if ready else 0.0
                        tile_r[i] = 1.0 if ready else 0.0
                        tile_p[i] = True
                elif depth_mm is not None and floor_mm is not None:
                    for i, t in enumerate(tiles):
                        if t.hit:
                            continue
                        if not tile_overlaps_play(t, play_top, play_bottom):
                            continue
                        poly = tile_cam_poly(
                            t, rects[t.lane],
                            H_canvas_to_cam=cal.H_canvas_to_cam,
                            shift_x=shift_x, shift_y=shift_y,
                            play_top=play_top, play_bottom=play_bottom,
                        )
                        if poly is None:
                            continue
                        d_score, r_score, area = tile_signals(
                            poly, depth_mm, floor_mm, color_gray, baseline_gray,
                            LIFT_MM_MIN, LIFT_MM_MAX, RGB_LIT_DELTA,
                        )
                        tile_d[i] = d_score
                        tile_r[i] = r_score
                        tile_area[i] = area
                        tile_p[i] = pressure_ok(t.lane, insole_snap, insole_enabled)

                if depth_mm is None and floor_mm is not None and (now - last_no_depth_log_t) >= 2.0:
                    _warn("play: no aligned depth/color frame — gate scores stay at zero")
                    last_no_depth_log_t = now

                if floor_mm is not None and depth_mm is not None:
                    for i, t in enumerate(tiles):
                        if t.hit:
                            continue
                        d_val = tile_d.get(i, 0.0)
                        r_val = tile_r.get(i, 0.0)
                        p_val = tile_p.get(
                            i, pressure_ok(t.lane, insole_snap, insole_enabled),
                        )
                        gate_key = f"{i}:{d_val:.2f}:{r_val:.2f}:{p_val}"
                        if (now - last_gate_log_t) >= 0.4 or gate_key != last_gate_key:
                            _info(
                                f"gate lane={LANE_NAMES[t.lane]} "
                                f"D={d_val:.0%} R={r_val:.0%} "
                                f"P={'Y' if p_val else 'N'} ({hit_need_label()})"
                            )
                            if tile_area.get(i, 0) == 0 and (now - last_no_depth_log_t) >= 2.0:
                                _warn(
                                    "gate poly area=0 — camera ROI misses tile; "
                                    "use H + arrows to tune hit_shift, then S"
                                )
                                last_no_depth_log_t = now
                            last_gate_log_t = now
                            last_gate_key = gate_key
                        break

                if (now - last_hit_t) >= HIT_COOLDOWN_S:
                    for i, t in enumerate(tiles):
                        if t.hit or i not in tile_p:
                            continue
                        if (
                            foot_hit_ok(tile_d.get(i, 0.0), tile_r.get(i, 0.0))
                            and tile_p[i]
                        ):
                            t.hit = True
                            t.hit_t = now
                            score += 1
                            combo_count += 1
                            if combo_count >= 10:
                                combo_count = 0
                                combo_burst_t = now
                                audio.play_motivation()
                            last_hit_t = now
                            audio.play_positive()
                            _info(
                                f"hit lane={LANE_NAMES[t.lane]} score={score} "
                                f"D={tile_d.get(i, 0.0):.0%} R={tile_r.get(i, 0.0):.0%}"
                            )
                            break

                kept: list[FallingTile] = []
                for t in tiles:
                    if t.hit:
                        if (now - t.hit_t) < 0.9:
                            kept.append(t)
                        continue
                    if t.y > play_bottom + t.h:
                        misses += 1
                        combo_count = 0
                        audio.play_correction()
                        _info(f"miss lane={LANE_NAMES[t.lane]} misses={misses}")
                        continue
                    kept.append(t)
                tiles = kept

            frame = pygame.Surface((cw, ch))
            draw_scene(
                frame,
                now=now,
                scr_w=cw, play_top=play_top, play_bottom=play_bottom,
                hit_y=hit_y, hit_window=hit_window, tiles=tiles,
                lane_names=LANE_NAMES, lane_colors=LANE_COLORS,
                bg_color=BG_COLOR, fg_color=FG_COLOR,
                center_hit_radius_frac=0.28,
                combo_count=combo_count,
                combo_burst_age=now - combo_burst_t if (now - combo_burst_t) < 1.45 else None,
            )

            if show_debug_hud:
                for t in tiles:
                    if t.hit:
                        continue
                    if not tile_overlaps_play(t, play_top, play_bottom):
                        continue
                    r_lane = rects[t.lane]
                    pad_x = max(8, r_lane.width // 12)
                    sx_left = r_lane.left + pad_x + shift_x
                    sx_right = r_lane.right - pad_x + shift_x
                    sy_top = int(t.y) + shift_y
                    sy_bot = int(t.y + t.h) + shift_y
                    pygame.draw.rect(
                        frame, (255, 0, 255),
                        pygame.Rect(sx_left, sy_top, sx_right - sx_left, sy_bot - sy_top),
                        width=2,
                    )
                shift_str = f"shift=({shift_x},{shift_y})"
                if shift_dirty:
                    shift_str += " *unsaved (S to save)"
                if (now - shift_saved_msg_t) < 1.2:
                    shift_str += "  SAVED"
                hud_lines = [
                    f"score: {score}  miss: {misses}  fps: {fps_ema:.1f}  state: {state}",
                    f"speed: {tile_speed_px_s:.0f}px/s (~{tile_speed_mps:.2f} m/s)  step: {step_time_s:.2f}s",
                    f"lift: [{LIFT_MM_MIN:.0f}..{LIFT_MM_MAX:.0f}]mm  {hit_need_label()}  Δlit:{RGB_LIT_DELTA}",
                    shift_str + "   arrows tune (Shift=x5)",
                    insole_hud_line(insole_snap, args.insole_thresh_kpa, INSOLE_MAX_AGE_S)
                    if insole_enabled else "insole: disabled (P=True)",
                    "DEMO: no sensors  H: debug  R: reset score  ESC/Q: quit"
                    if demo_mode else "SPACE: capture floor  H: debug  S: save shift  R: reset score  ESC/Q: quit",
                ]
                hud = hud_surface(hud_lines, fg_color=FG_COLOR)
                frame.blit(hud, (12, 12))
            if rot:
                frame = pygame.transform.rotate(frame, rot)
            screen.fill(BG_COLOR)
            screen.blit(frame, ((scr_w - frame.get_width()) // 2, (scr_h - frame.get_height()) // 2))

            if not demo_mode and state == "wait_floor" and camera_feed is not None:
                if camera_feed.has_aligned_frames():
                    prompt = "SPACE: capture floor baseline (stand off the mat)"
                else:
                    prompt = "waiting for camera frames..."
                if (now - floor_capture_msg_t) < 2.0:
                    prompt = "no floor capture — wait for camera, then SPACE again"
                prompt_surf = hud_surface([prompt], fg_color=FG_COLOR)
                screen.blit(
                    prompt_surf,
                    ((scr_w - prompt_surf.get_width()) // 2, scr_h - prompt_surf.get_height() - 24),
                )
            pygame.display.flip()

            for e in pygame.event.get():
                if e.type == pygame.QUIT:
                    audio.play_intro_end()
                    running = False
                elif e.type == pygame.KEYDOWN:
                    if e.key in (pygame.K_ESCAPE, pygame.K_q):
                        audio.play_intro_end()
                        running = False
                    elif e.key == pygame.K_SPACE:
                        if not demo_mode and camera_feed is not None:
                            new_floor, new_gray = camera_feed.capture_floor(FLOOR_CAPTURE_FRAMES)
                            if new_floor is not None:
                                floor_mm = new_floor
                                baseline_gray = new_gray
                                state = "play"
                                session_intro_played = False
                                tiles.clear()
                                next_lane = 0
                                next_spawn_t = time.perf_counter() + 0.8
                                _info("floor baseline captured — play started")
                            else:
                                floor_capture_msg_t = time.perf_counter()
                                _warn("floor capture failed — no aligned camera pairs")
                    elif e.key == pygame.K_r:
                        score = 0
                        misses = 0
                        combo_count = 0
                    elif e.key == pygame.K_h:
                        show_debug_hud = not show_debug_hud
                    elif e.key == pygame.K_s:
                        try:
                            save_shift(CALIBRATION_JSON, (shift_x, shift_y))
                            shift_dirty = False
                            shift_saved_msg_t = now
                        except Exception as exc:
                            print(f"[tile_game] save shift failed: {exc}", file=sys.stderr)
                    elif e.key in (
                        pygame.K_LEFT, pygame.K_RIGHT, pygame.K_UP, pygame.K_DOWN
                    ):
                        step = 50 if (pygame.key.get_mods() & pygame.KMOD_SHIFT) else 10
                        if e.key == pygame.K_LEFT:
                            shift_x -= step
                        elif e.key == pygame.K_RIGHT:
                            shift_x += step
                        elif e.key == pygame.K_UP:
                            shift_y -= step
                        elif e.key == pygame.K_DOWN:
                            shift_y += step
                        shift_dirty = True

            clock.tick(60)
    finally:
        audio.stop()
        pygame.quit()
