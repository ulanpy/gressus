#!/usr/bin/env python3
"""Depth-only floor subtraction debug for treadmill area (RealSense D435)."""

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
    p = argparse.ArgumentParser(description="Debug floor-vs-person segmentation by depth.")
    p.add_argument("--depth-width", type=int, default=848)
    p.add_argument("--depth-height", type=int, default=480)
    p.add_argument("--depth-fps", type=int, default=30)
    p.add_argument("--color-width", type=int, default=1280)
    p.add_argument("--color-height", type=int, default=720)
    p.add_argument("--color-fps", type=int, default=30)
    p.add_argument(
        "--lift-mm",
        type=float,
        default=70.0,
        help="How much closer than floor model (in mm) counts as foreground.",
    )
    p.add_argument(
        "--min-area",
        type=int,
        default=1800,
        help="Minimum contour area to keep.",
    )
    p.add_argument(
        "--calib-frames",
        type=int,
        default=45,
        help="How many frames to average for empty-floor model.",
    )
    p.add_argument(
        "--align-to-color",
        action="store_true",
        help="Align depth to color stream coordinates.",
    )
    p.add_argument(
        "--roi",
        type=str,
        default="",
        help="Optional ROI x,y,w,h in aligned frame.",
    )
    p.add_argument(
        "--max-distance-m",
        type=float,
        default=3.0,
        help="Depth colormap clip distance in meters.",
    )
    p.add_argument(
        "--no-auto-fallback",
        action="store_true",
        help="Do not try fallback stream profiles if requested profile fails.",
    )
    return p.parse_args()


def parse_roi(spec: str, w: int, h: int) -> tuple[int, int, int, int]:
    if not spec.strip():
        return 0, 0, w, h
    vals = [int(v.strip()) for v in spec.split(",")]
    if len(vals) != 4:
        raise ValueError("--roi must be x,y,w,h")
    x, y, rw, rh = vals
    x = int(np.clip(x, 0, max(0, w - 1)))
    y = int(np.clip(y, 0, max(0, h - 1)))
    rw = int(np.clip(rw, 1, w - x))
    rh = int(np.clip(rh, 1, h - y))
    return x, y, rw, rh


def largest_centroid(mask: np.ndarray, min_area: int) -> tuple[int, int] | None:
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    best = None
    best_area = 0.0
    for c in contours:
        a = cv2.contourArea(c)
        if a < min_area or a <= best_area:
            continue
        m = cv2.moments(c)
        if m["m00"] <= 1e-6:
            continue
        cx = int(m["m10"] / m["m00"])
        cy = int(m["m01"] / m["m00"])
        best = (cx, cy)
        best_area = a
    return best


def _build_candidate_profiles(args: argparse.Namespace) -> list[tuple[int, int, int, int, int, int]]:
    candidates = [
        (
            args.depth_width,
            args.depth_height,
            args.depth_fps,
            args.color_width,
            args.color_height,
            args.color_fps,
        ),
    ]
    if args.no_auto_fallback:
        return candidates
    candidates.extend(
        [
            (640, 480, 30, 640, 480, 30),
            (640, 480, 15, 640, 480, 15),
            (640, 480, 6, 640, 480, 6),
            (848, 480, 30, 640, 480, 30),
            (848, 480, 15, 640, 480, 15),
            (424, 240, 30, 640, 480, 30),
            (424, 240, 15, 640, 480, 15),
        ]
    )
    uniq: list[tuple[int, int, int, int, int, int]] = []
    for c in candidates:
        if c not in uniq:
            uniq.append(c)
    return uniq


def _start_with_fallback(
    pipe: rs.pipeline,
    args: argparse.Namespace,
) -> tuple[rs.pipeline_profile, tuple[int, int, int, int, int, int]]:
    errors: list[str] = []
    for dw, dh, dfps, cw, ch, cfps in _build_candidate_profiles(args):
        cfg = rs.config()
        cfg.enable_stream(rs.stream.depth, dw, dh, rs.format.z16, dfps)
        cfg.enable_stream(rs.stream.color, cw, ch, rs.format.bgr8, cfps)
        try:
            profile = pipe.start(cfg)
            return profile, (dw, dh, dfps, cw, ch, cfps)
        except RuntimeError as e:
            errors.append(
                f"depth {dw}x{dh}@{dfps}, color {cw}x{ch}@{cfps}: {e}"
            )
    raise RuntimeError("\n".join(errors))


def main() -> None:
    args = parse_args()

    pipe = rs.pipeline()
    profile, used = _start_with_fallback(pipe, args)
    dev = profile.get_device()
    depth_scale_m = float(dev.first_depth_sensor().get_depth_scale())
    align = rs.align(rs.stream.color) if args.align_to_color else None

    usb_mode = "n/a"
    try:
        usb_mode = dev.get_info(rs.camera_info.usb_type_descriptor)
    except Exception:
        pass
    print(f"usb: {usb_mode}")
    print(
        "active profile: "
        f"depth {used[0]}x{used[1]}@{used[2]}, color {used[3]}x{used[4]}@{used[5]}"
    )
    print("keys: SPACE calibrate floor, r reset floor model, q/esc quit")

    floor_model_mm: np.ndarray | None = None
    fps_ema = 0.0
    t_prev = time.perf_counter()

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
            h, w = depth_mm.shape
            rx, ry, rw, rh = parse_roi(args.roi, w, h)

            roi_depth = depth_mm[ry : ry + rh, rx : rx + rw]
            valid_roi = roi_depth > 0.0
            mask = np.zeros((rh, rw), dtype=np.uint8)
            centroid: tuple[int, int] | None = None

            if floor_model_mm is not None:
                floor_roi = floor_model_mm[ry : ry + rh, rx : rx + rw]
                delta = floor_roi - roi_depth
                mask[(delta > args.lift_mm) & valid_roi] = 255
                mask = cv2.morphologyEx(
                    mask, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8), iterations=1
                )
                mask = cv2.morphologyEx(
                    mask, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8), iterations=1
                )
                c = largest_centroid(mask, args.min_area)
                if c is not None:
                    centroid = (c[0] + rx, c[1] + ry)

            depth_mm_vis = np.clip(depth_mm, 0.0, args.max_distance_m * 1000.0)
            depth_u8 = (
                255.0 * depth_mm_vis / (args.max_distance_m * 1000.0 + 1e-6)
            ).astype(np.uint8)
            depth_color = cv2.applyColorMap(depth_u8, cv2.COLORMAP_TURBO)
            depth_color[depth_mm <= 0.0] = (0, 0, 0)

            overlay = color.copy()
            cv2.rectangle(overlay, (rx, ry), (rx + rw - 1, ry + rh - 1), (255, 220, 60), 2)

            if floor_model_mm is not None:
                mask_full = np.zeros((h, w), dtype=np.uint8)
                mask_full[ry : ry + rh, rx : rx + rw] = mask
                fg_idx = mask_full > 0
                if np.any(fg_idx):
                    fg = overlay[fg_idx].astype(np.float32)
                    tint = np.array([60.0, 220.0, 80.0], dtype=np.float32)
                    overlay[fg_idx] = (0.3 * fg + 0.7 * tint).astype(np.uint8)
                if centroid is not None:
                    cv2.circle(overlay, centroid, 14, (40, 255, 80), 3, cv2.LINE_AA)

            t_now = time.perf_counter()
            dt = max(1e-6, t_now - t_prev)
            t_prev = t_now
            fps = 1.0 / dt
            fps_ema = fps if fps_ema <= 0.0 else 0.9 * fps_ema + 0.1 * fps
            state = "play" if floor_model_mm is not None else "wait_bg"
            lines = [
                f"state: {state}  fps: {fps_ema:.1f}  usb: {usb_mode}",
                f"lift_mm: {args.lift_mm:.0f}  min_area: {args.min_area}  roi: {rx},{ry},{rw},{rh}",
                "SPACE calibrate empty floor | r reset | q/esc quit",
            ]
            y = 28
            for line in lines:
                cv2.putText(
                    overlay,
                    line,
                    (12, y),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.7,
                    (230, 230, 240),
                    2,
                    cv2.LINE_AA,
                )
                y += 28

            stacked = np.hstack(
                [
                    overlay,
                    cv2.resize(depth_color, (overlay.shape[1], overlay.shape[0])),
                ]
            )
            cv2.imshow("realsense floor debug (segmentation | depth)", stacked)

            k = cv2.waitKey(1) & 0xFF
            if k in (27, ord("q")):
                break
            if k == ord("r"):
                floor_model_mm = None
                print("floor model reset")
            if k == ord(" "):
                samples: list[np.ndarray] = []
                print(f"capturing floor model: {args.calib_frames} frames")
                for _ in range(args.calib_frames):
                    frs = pipe.wait_for_frames(timeout_ms=5000)
                    if align is not None:
                        frs = align.process(frs)
                    d = frs.get_depth_frame()
                    if not d:
                        continue
                    dmm = np.asanyarray(d.get_data()).astype(np.float32) * depth_scale_m * 1000.0
                    samples.append(dmm)
                if samples:
                    st = np.stack(samples, axis=0)
                    floor_model_mm = np.median(st, axis=0).astype(np.float32)
                    print("floor model captured")
                else:
                    print("failed to capture floor model")
    finally:
        pipe.stop()
        cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
