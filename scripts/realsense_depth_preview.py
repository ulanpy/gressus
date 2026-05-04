#!/usr/bin/env python3
"""RealSense D435 preview: color + aligned depth with FPS and USB mode."""

from __future__ import annotations

import argparse
import os
import sys
import time

# OpenCV Qt plugin in this env provides xcb only; on Wayland force xcb backend.
if os.environ.get("WAYLAND_DISPLAY") and not os.environ.get("QT_QPA_PLATFORM"):
    os.environ["QT_QPA_PLATFORM"] = "xcb"

import cv2
import numpy as np

try:
    import pyrealsense2 as rs
except ImportError as e:  # pragma: no cover
    print("pyrealsense2 is not installed. Run: poetry add pyrealsense2", file=sys.stderr)
    raise SystemExit(1) from e


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Preview Intel RealSense color + depth.")
    p.add_argument("--depth-width", type=int, default=640)
    p.add_argument("--depth-height", type=int, default=480)
    p.add_argument("--depth-fps", type=int, default=15)
    p.add_argument("--color-width", type=int, default=640)
    p.add_argument("--color-height", type=int, default=480)
    p.add_argument("--color-fps", type=int, default=15)
    p.add_argument(
        "--align-to-color",
        action="store_true",
        help="Align depth to color stream coordinates.",
    )
    p.add_argument(
        "--max-distance-m",
        type=float,
        default=3.0,
        help="Depth colormap clip distance in meters.",
    )
    return p.parse_args()


def _device_info(dev: rs.device) -> dict[str, str]:
    def get(ci: rs.camera_info, fallback: str = "n/a") -> str:
        try:
            return dev.get_info(ci)
        except Exception:
            return fallback

    return {
        "name": get(rs.camera_info.name),
        "serial": get(rs.camera_info.serial_number),
        "usb": get(rs.camera_info.usb_type_descriptor),
        "fw": get(rs.camera_info.firmware_version),
    }


def _build_preview(
    color_bgr: np.ndarray,
    depth_mm: np.ndarray,
    max_distance_m: float,
    hud_lines: list[str],
) -> np.ndarray:
    depth_mm_vis = np.clip(depth_mm, 0.0, max_distance_m * 1000.0)
    depth_u8 = (255.0 * depth_mm_vis / (max_distance_m * 1000.0 + 1e-6)).astype(np.uint8)
    depth_color = cv2.applyColorMap(depth_u8, cv2.COLORMAP_TURBO)
    depth_color[depth_mm <= 0.0] = (0, 0, 0)
    if depth_color.shape[:2] != color_bgr.shape[:2]:
        depth_color = cv2.resize(
            depth_color,
            (color_bgr.shape[1], color_bgr.shape[0]),
            interpolation=cv2.INTER_NEAREST,
        )

    preview = np.hstack([color_bgr, depth_color])
    y = 28
    for line in hud_lines:
        cv2.putText(
            preview,
            line,
            (12, y),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (230, 230, 240),
            2,
            cv2.LINE_AA,
        )
        y += 28
    return preview


def _print_supported_profiles(dev: rs.device) -> None:
    print("supported stream profiles:")
    for sensor in dev.query_sensors():
        try:
            sname = sensor.get_info(rs.camera_info.name)
        except Exception:
            sname = "sensor"
        print(f"- {sname}:")
        seen: set[tuple[str, int, int, int, str]] = set()
        for prof in sensor.get_stream_profiles():
            try:
                vsp = prof.as_video_stream_profile()
                key = (
                    str(prof.stream_type()),
                    int(vsp.width()),
                    int(vsp.height()),
                    int(prof.fps()),
                    str(prof.format()),
                )
                if key in seen:
                    continue
                seen.add(key)
                print(
                    f"    {key[0]} {key[1]}x{key[2]} @ {key[3]} fps ({key[4]})"
                )
            except Exception:
                continue


def _start_pipeline(
    pipe: rs.pipeline,
    args: argparse.Namespace,
) -> tuple[rs.pipeline_profile, tuple[int, int, int, int, int, int]]:
    dw = args.depth_width
    dh = args.depth_height
    dfps = args.depth_fps
    cw = args.color_width
    ch = args.color_height
    cfps = args.color_fps
    cfg = rs.config()
    cfg.enable_stream(rs.stream.depth, dw, dh, rs.format.z16, dfps)
    cfg.enable_stream(rs.stream.color, cw, ch, rs.format.bgr8, cfps)
    profile = pipe.start(cfg)
    return profile, (dw, dh, dfps, cw, ch, cfps)


def main() -> None:
    args = parse_args()

    pipe = rs.pipeline()
    started = False
    try:
        profile, used = _start_pipeline(pipe, args)
        started = True
        dev = profile.get_device()
    except RuntimeError as e:
        print("failed to start pipeline with requested profile.", file=sys.stderr)
        print(
            f"requested: depth {args.depth_width}x{args.depth_height}@{args.depth_fps}, "
            f"color {args.color_width}x{args.color_height}@{args.color_fps}",
            file=sys.stderr,
        )
        print(str(e), file=sys.stderr)
        ctx = rs.context()
        devs = ctx.query_devices()
        if devs.size() > 0:
            _print_supported_profiles(devs[0])
        raise SystemExit(2) from e

    info = _device_info(dev)
    depth_sensor = dev.first_depth_sensor()
    depth_scale_m = float(depth_sensor.get_depth_scale())
    align = rs.align(rs.stream.color) if args.align_to_color else None

    print(f"device: {info['name']}")
    print(f"serial: {info['serial']}")
    print(f"usb:    {info['usb']}")
    print(f"fw:     {info['fw']}")
    print(f"depth_scale_m: {depth_scale_m:.6f}")
    print(
        "active profile: "
        f"depth {used[0]}x{used[1]}@{used[2]}, color {used[3]}x{used[4]}@{used[5]}"
    )
    print("keys: q/esc - quit, s - save snapshot")

    fps_ema = 0.0
    t_prev = time.perf_counter()
    snap_id = 0
    try:
        while True:
            frames = pipe.wait_for_frames(timeout_ms=5000)
            if align is not None:
                frames = align.process(frames)
            dfr = frames.get_depth_frame()
            cfr = frames.get_color_frame()
            if not dfr or not cfr:
                continue

            color = np.asanyarray(cfr.get_data())
            depth_raw = np.asanyarray(dfr.get_data())
            depth_mm = depth_raw.astype(np.float32) * depth_scale_m * 1000.0

            t_now = time.perf_counter()
            dt = max(1e-6, t_now - t_prev)
            t_prev = t_now
            fps_inst = 1.0 / dt
            fps_ema = fps_inst if fps_ema <= 0.0 else 0.9 * fps_ema + 0.1 * fps_inst

            center_mm = 0.0
            cy, cx = depth_mm.shape[0] // 2, depth_mm.shape[1] // 2
            center_mm = float(depth_mm[cy, cx])
            hud = [
                f"FPS: {fps_ema:.1f}  USB: {info['usb']}  align_to_color: {args.align_to_color}",
                f"depth: {depth_mm.shape[1]}x{depth_mm.shape[0]}  color: {color.shape[1]}x{color.shape[0]}",
                f"center depth: {center_mm:.0f} mm",
            ]
            preview = _build_preview(color, depth_mm, args.max_distance_m, hud)
            cv2.imshow("realsense preview (color | depth)", preview)

            k = cv2.waitKey(1) & 0xFF
            if k in (27, ord("q")):
                break
            if k == ord("s"):
                color_path = f"realsense_color_{snap_id:03d}.png"
                depth_path = f"realsense_depth_mm_{snap_id:03d}.npy"
                cv2.imwrite(color_path, color)
                np.save(depth_path, depth_mm)
                print(f"saved: {color_path}, {depth_path}")
                snap_id += 1
    finally:
        if started:
            pipe.stop()
        cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
