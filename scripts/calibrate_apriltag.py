#!/usr/bin/env python3
"""AprilTag 36h11: 4 угла → гомография в config. Enter=сохранить, Esc=выход, S=jpg. HUD по центру (ASCII)."""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

import cv2
import numpy as np
import pygame

sys.path.insert(0, str(Path(__file__).resolve().parent))
import display_utils  # noqa: E402

TAG_FAMILY = "DICT_APRILTAG_36h11"
TAG_IDS = (0, 1, 2, 3)


def _pupil_apriltags_available() -> bool:
    try:
        import pupil_apriltags  # noqa: F401
        return True
    except ImportError:
        return False


def _parse_camera_arg(s: str) -> int | str:
    s = s.strip()
    if s.startswith("/dev/") or s.startswith("v4l2:"):
        return s
    if s.isdigit():
        return int(s)
    return s


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Калибровка камера–проектор (AprilTag).")
    p.add_argument(
        "-c",
        "--camera",
        type=_parse_camera_arg,
        default="0",
        help="V4L2: путь /dev/videoN (предпочтительно) или индекс. Индекс ≠ номер videoN!",
    )
    p.add_argument(
        "-d",
        "--display",
        type=int,
        default=None,
        metavar="N",
        help="Индекс монитора pygame (часто 1 = HDMI-проектор). По умолчанию — последний.",
    )
    p.add_argument(
        "-o",
        "--output",
        type=Path,
        default=Path("config/calibration.json"),
        help="Куда сохранить JSON с гомографией.",
    )
    p.add_argument(
        "--tag-size",
        type=int,
        default=None,
        metavar="PX",
        help="Сторона тега в пикселях экрана. По умолчанию — от размера экрана.",
    )
    p.add_argument(
        "--margin",
        type=int,
        default=None,
        metavar="PX",
        help="Отступ от края до тега. По умолчанию — от размера экрана.",
    )
    p.add_argument(
        "--flip",
        action="store_true",
        help="Горизонтально отразить кадр камеры (если картинка зеркальная).",
    )
    p.add_argument(
        "-v",
        "--verbose",
        action="store_true",
        help="Печатать в stderr, сколько тегов видно и какие id (отладка).",
    )
    p.add_argument(
        "--no-clahe",
        action="store_true",
        help="Не применять CLAHE к яркости (если картинка становится хуже).",
    )
    p.add_argument(
        "--no-mjpeg",
        action="store_true",
        help="Не задавать MJPG (по умолчанию MJPEG включён — без него часто остаётся 640x480).",
    )
    p.add_argument(
        "--width",
        type=int,
        default=1920,
        help="Запрашиваемая ширина (подгоните под рабочий mpv, часто 1920).",
    )
    p.add_argument(
        "--height",
        type=int,
        default=1080,
        help="Запрашиваемая высота (часто 1080 вместе с --width 1920).",
    )
    p.add_argument(
        "--backend",
        choices=("pupil", "opencv"),
        default="pupil",
        help="Детектор: pupil-apriltags (по умолчанию, лучше на MJPEG/проекции) или OpenCV ArucoDetector.",
    )
    p.add_argument(
        "--no-bilateral",
        action="store_true",
        help="Не применять bilateral filter (шум MJPEG; по умолчанию фильтр включён для backend pupil).",
    )
    p.add_argument(
        "--no-fps-probe",
        action="store_true",
        help="Не делать замер FPS при старте (чуть быстрее открыть окно).",
    )
    p.add_argument(
        "--no-onscreen-hud",
        action="store_true",
        help="Не рисовать HUD с FPS (по умолчанию по центру экрана).",
    )
    return p.parse_args()


def _make_aruco_detector() -> cv2.aruco.ArucoDetector:
    dictionary = cv2.aruco.getPredefinedDictionary(cv2.aruco.DICT_APRILTAG_36h11)
    params = cv2.aruco.DetectorParameters()
    params.cornerRefinementMethod = cv2.aruco.CORNER_REFINE_APRILTAG
    params.minMarkerPerimeterRate = 0.004
    params.maxMarkerPerimeterRate = 8.0
    params.adaptiveThreshWinSizeMin = 3
    params.adaptiveThreshWinSizeMax = 25
    params.adaptiveThreshWinSizeStep = 2
    params.aprilTagMinWhiteBlackDiff = 1
    params.aprilTagMinClusterPixels = 3
    return cv2.aruco.ArucoDetector(dictionary, params)


def _make_pupil_detector():
    import pupil_apriltags as pupil_apriltags

    return pupil_apriltags.Detector(
        families="tag36h11",
        nthreads=2,
        quad_decimate=1.0,
        refine_edges=1,
    )


def _make_tag_cell(
    dictionary: cv2.aruco.Dictionary, tag_id: int, cell_sz: int
) -> tuple[np.ndarray, float, float]:
    quiet = max(8, cell_sz // 8)
    inner = max(32, cell_sz - 2 * quiet)
    tag = cv2.aruco.generateImageMarker(dictionary, tag_id, inner)
    cell = np.ones((cell_sz, cell_sz), dtype=np.uint8) * 255
    th, tw = tag.shape[:2]
    x0 = (cell_sz - tw) // 2
    y0 = (cell_sz - th) // 2
    cell[y0 : y0 + th, x0 : x0 + tw] = tag
    cx = x0 + tw / 2.0
    cy = y0 + th / 2.0
    return cell, cx, cy


def _gray_to_pygame_surface(gray: np.ndarray) -> pygame.Surface:
    rgb = cv2.cvtColor(gray, cv2.COLOR_GRAY2RGB)
    h, w = rgb.shape[:2]
    surf = pygame.image.frombuffer(rgb.tobytes(), (w, h), "RGB")
    return surf.convert()


def _tag_corner_positions(
    proj_w: int, proj_h: int, margin: int, tag_sz: int
) -> dict[int, tuple[int, int]]:
    return {
        0: (margin, margin),
        1: (proj_w - margin - tag_sz, margin),
        2: (proj_w - margin - tag_sz, proj_h - margin - tag_sz),
        3: (margin, proj_h - margin - tag_sz),
    }


def _expected_centers_proj(
    corner_top_left: dict[int, tuple[int, int]], cx: float, cy: float
) -> np.ndarray:
    out = np.zeros((4, 2), dtype=np.float32)
    for tid in TAG_IDS:
        x, y = corner_top_left[tid]
        out[tid] = (x + cx, y + cy)
    return out


def _gray_preprocessing_variants(
    gray: np.ndarray, use_clahe: bool, use_bilateral: bool
) -> list[np.ndarray]:
    out: list[np.ndarray] = [gray]
    if use_bilateral:
        out.append(cv2.bilateralFilter(gray, 9, 75, 75))
    if use_clahe:
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        out.append(clahe.apply(gray))
        if use_bilateral:
            out.append(clahe.apply(cv2.bilateralFilter(gray, 9, 75, 75)))
    return out


def _detect_tag_centers_opencv(
    frame_bgr: np.ndarray,
    detector: cv2.aruco.ArucoDetector,
    flip: bool,
    use_clahe: bool,
) -> dict[int, np.ndarray]:
    if flip:
        frame_bgr = cv2.flip(frame_bgr, 1)
    gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
    variants = _gray_preprocessing_variants(gray, use_clahe=use_clahe, use_bilateral=False)

    centers: dict[int, np.ndarray] = {}
    for g in variants:
        h, w = g.shape[:2]

        def _ingest(corners, ids, scale: float) -> None:
            if ids is None or len(ids) == 0:
                return
            inv = 1.0 / scale
            flat_ids = ids.flatten()
            for i, c in enumerate(corners):
                tid = int(flat_ids[i])
                pts = c.reshape(4, 2).astype(np.float64) * inv
                centers[tid] = pts.mean(axis=0).astype(np.float32)

        for scale in (1.0, 1.5, 2.0, 3.0):
            if abs(scale - 1.0) < 1e-6:
                img = g
            else:
                img = cv2.resize(
                    g,
                    (max(1, int(w * scale)), max(1, int(h * scale))),
                    interpolation=cv2.INTER_CUBIC,
                )
            corners, ids, _rej = detector.detectMarkers(img)
            _ingest(corners, ids, scale)
            if len(centers) >= 4:
                return centers
        if len(centers) >= 4:
            return centers
    return centers


def _detect_tag_centers_pupil(
    frame_bgr: np.ndarray,
    pupil_det,
    flip: bool,
    use_clahe: bool,
    use_bilateral: bool,
) -> dict[int, np.ndarray]:
    if flip:
        frame_bgr = cv2.flip(frame_bgr, 1)
    gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
    variants = _gray_preprocessing_variants(
        gray, use_clahe=use_clahe, use_bilateral=use_bilateral
    )

    centers: dict[int, np.ndarray] = {}
    for g in variants:
        h, w = g.shape[:2]
        for scale in (1.0, 1.5, 2.0, 3.0):
            if abs(scale - 1.0) < 1e-6:
                img = g
            else:
                img = cv2.resize(
                    g,
                    (max(1, int(w * scale)), max(1, int(h * scale))),
                    interpolation=cv2.INTER_CUBIC,
                )
            inv = 1.0 / scale
            for r in pupil_det.detect(img):
                tid = int(r.tag_id)
                c = np.asarray(r.center, dtype=np.float64) * inv
                centers[tid] = c.astype(np.float32)
            if len(centers) >= 4:
                return centers
        if len(centers) >= 4:
            return centers
    return centers


def _fourcc_str(cap: cv2.VideoCapture) -> str:
    try:
        c = int(cap.get(cv2.CAP_PROP_FOURCC))
        if c == 0:
            return ""
        return "".join(chr((c >> 8 * i) & 0xFF) for i in range(4))
    except Exception:
        return ""


def _fourcc_log_label(cap: cv2.VideoCapture, requested_mjpeg: bool) -> str:
    s = _fourcc_str(cap)
    if s:
        return repr(s)
    if requested_mjpeg:
        return "MJPG (запрошено; CAP_PROP_FOURCC от драйвера = 0 — так бывает на V4L2)"
    return "неизвестно (FOURCC=0)"


def _configure_capture(
    cap: cv2.VideoCapture,
    width: int,
    height: int,
    use_mjpeg: bool,
) -> tuple[int, int]:
    if use_mjpeg:
        cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*"MJPG"))
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, float(width))
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, float(height))
    try:
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
    except Exception:
        pass
    for _ in range(8):
        cap.read()
    aw = int(round(cap.get(cv2.CAP_PROP_FRAME_WIDTH)))
    ah = int(round(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)))
    return aw, ah


def _probe_fps(cap: cv2.VideoCapture, n_frames: int = 45) -> tuple[float, float]:
    t0 = time.perf_counter()
    for _ in range(n_frames):
        cap.read()
    dt = time.perf_counter() - t0
    measured = (n_frames / dt) if dt > 0 else 0.0
    reported = float(cap.get(cv2.CAP_PROP_FPS) or 0.0)
    return reported, measured


def _draw_status_bar(screen: pygame.Surface, proj_w: int, proj_h: int, ok: bool) -> None:
    hbar = max(8, proj_h // 80)
    y0 = proj_h - hbar * 2
    color = (60, 180, 90) if ok else (180, 90, 60)
    pygame.draw.rect(screen, color, (0, y0, proj_w, hbar))


def _hud_overlay_surface(lines: list[str]) -> pygame.Surface:
    font_scale = 0.55
    thickness = 1
    line_h = 22
    pad = 8
    max_w = 0
    for line in lines:
        (tw, _th), _ = cv2.getTextSize(
            line, cv2.FONT_HERSHEY_SIMPLEX, font_scale, thickness
        )
        max_w = max(max_w, tw)
    h = pad * 2 + len(lines) * line_h
    w = max(260, pad * 2 + max_w + 4)
    img = np.full((h, w, 3), 255, dtype=np.uint8)
    cv2.rectangle(img, (0, 0), (w - 1, h - 1), (200, 200, 200), 1)
    for i, line in enumerate(lines):
        cv2.putText(
            img,
            line,
            (pad, pad + 16 + i * line_h),
            cv2.FONT_HERSHEY_SIMPLEX,
            font_scale,
            (55, 55, 55),
            thickness,
            cv2.LINE_AA,
        )
    rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    return pygame.image.frombuffer(rgb.tobytes(), (w, h), "RGB").convert()


def main() -> None:
    args = parse_args()
    use_mjpeg = not args.no_mjpeg
    args.output.parent.mkdir(parents=True, exist_ok=True)

    if args.backend == "pupil" and not _pupil_apriltags_available():
        print(
            "[calib] модуль pupil_apriltags не установлен в текущем venv. "
            "Из корня проекта выполните: poetry install\n"
            "Переключаюсь на --backend opencv.",
            file=sys.stderr,
        )
        args.backend = "opencv"

    dictionary = cv2.aruco.getPredefinedDictionary(cv2.aruco.DICT_APRILTAG_36h11)
    opencv_detector = _make_aruco_detector() if args.backend == "opencv" else None
    pupil_detector = _make_pupil_detector() if args.backend == "pupil" else None

    screen, proj_w, proj_h, _didx = display_utils.open_fullscreen(
        args.display, "AprilTag calibration"
    )

    margin = args.margin if args.margin is not None else max(16, min(proj_w, proj_h) // 24)
    tag_sz = args.tag_size if args.tag_size is not None else max(120, min(proj_w, proj_h) // 8)
    if margin * 2 + tag_sz > min(proj_w, proj_h):
        tag_sz = max(64, min(proj_w, proj_h) // 2 - 2 * margin)

    corners_px = _tag_corner_positions(proj_w, proj_h, margin, tag_sz)
    _, cx, cy = _make_tag_cell(dictionary, TAG_IDS[0], tag_sz)
    tag_surfaces = {
        tid: _gray_to_pygame_surface(_make_tag_cell(dictionary, tid, tag_sz)[0])
        for tid in TAG_IDS
    }

    cap = cv2.VideoCapture(args.camera)
    if not cap.isOpened():
        print(f"Не удалось открыть камеру --camera {args.camera}", file=sys.stderr)
        pygame.quit()
        sys.exit(1)

    aw, ah = _configure_capture(cap, args.width, args.height, use_mjpeg)
    fcc_lbl = _fourcc_log_label(cap, use_mjpeg)
    print(
        f"[calib] {args.camera!r} {aw}x{ah} {fcc_lbl} mjpeg={use_mjpeg} backend={args.backend}",
        file=sys.stderr,
    )
    startup_rep, startup_meas = 0.0, 0.0
    if not args.no_fps_probe:
        startup_rep, startup_meas = _probe_fps(cap, n_frames=45)
        print(
            f"[calib] CAP_PROP_FPS={startup_rep:.1f} grab~{startup_meas:.1f}",
            file=sys.stderr,
        )

    clock = pygame.time.Clock()
    running = True
    last_centers: dict[int, np.ndarray] = {}
    all_four = False
    frame_i = 0
    last_frame: np.ndarray | None = None
    last_frame_shape: tuple[int, int] | None = None
    smoothed_wall_fps = 0.0
    last_instant_fps = 0.0
    prev_flip_t: float | None = None

    try:
        while running:
            screen.fill((255, 255, 255))
            for tid in TAG_IDS:
                screen.blit(tag_surfaces[tid], corners_px[tid])

            ok, frame = cap.read()
            if ok:
                last_frame = frame
                fh, fw = frame.shape[:2]
                last_frame_shape = (fw, fh)
                if args.backend == "pupil":
                    assert pupil_detector is not None
                    last_centers = _detect_tag_centers_pupil(
                        frame,
                        pupil_detector,
                        flip=args.flip,
                        use_clahe=not args.no_clahe,
                        use_bilateral=not args.no_bilateral,
                    )
                else:
                    assert opencv_detector is not None
                    last_centers = _detect_tag_centers_opencv(
                        frame,
                        opencv_detector,
                        flip=args.flip,
                        use_clahe=not args.no_clahe,
                    )
                found = set(last_centers.keys())
                all_four = found == set(TAG_IDS)
                if args.verbose and frame_i % 30 == 0:
                    print(
                        f"[calib] backend={args.backend} frame {fw}x{fh} "
                        f"tags={len(found)} ids={sorted(found)}",
                        file=sys.stderr,
                    )
                frame_i += 1

            _draw_status_bar(screen, proj_w, proj_h, all_four)

            if not args.no_onscreen_hud:
                if args.no_fps_probe:
                    grab_line = "startup probe: off (--no-fps-probe)"
                else:
                    grab_line = (
                        f"startup grab: {startup_meas:.1f}  "
                        f"CAP_PROP_FPS: {startup_rep:.1f}"
                    )
                hud_lines = [
                    f"wall dt fps: inst {last_instant_fps:.2f}  avg {smoothed_wall_fps:.2f}",
                    grab_line,
                    f"camera: {last_frame_shape[0]}x{last_frame_shape[1]}"
                    if last_frame_shape is not None
                    else "camera: no frames",
                    f"found ids: {sorted(last_centers.keys())}  need: {list(TAG_IDS)}",
                ]
                hud = _hud_overlay_surface(hud_lines)
                screen.blit(
                    hud,
                    (
                        proj_w // 2 - hud.get_width() // 2,
                        proj_h // 2 - hud.get_height() // 2,
                    ),
                )

            pygame.display.flip()
            flip_t = time.perf_counter()
            if prev_flip_t is not None:
                wall_dt = flip_t - prev_flip_t
                if wall_dt > 1e-6:
                    last_instant_fps = 1.0 / wall_dt
                    if smoothed_wall_fps <= 0:
                        smoothed_wall_fps = last_instant_fps
                    else:
                        smoothed_wall_fps = (
                            0.55 * smoothed_wall_fps + 0.45 * last_instant_fps
                        )
            prev_flip_t = flip_t

            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    running = False
                elif event.type == pygame.KEYDOWN:
                    if event.key in (pygame.K_ESCAPE, pygame.K_q):
                        running = False
                    elif event.key == pygame.K_s and last_frame is not None:
                        dbg = Path("calibrate_debug.jpg")
                        cv2.imwrite(str(dbg), last_frame)
                        print(f"[calib] сохранён кадр камеры: {dbg.resolve()}", file=sys.stderr)
                    elif event.key in (pygame.K_RETURN, pygame.K_KP_ENTER):
                        if not all_four:
                            print(
                                "В кадре не все 4 тега — подвиньте камеру/свет или Esc.",
                                file=sys.stderr,
                            )
                            continue
                        pts_proj = _expected_centers_proj(corners_px, cx, cy)
                        pts_cam = np.zeros((4, 2), dtype=np.float32)
                        for i in TAG_IDS:
                            pts_cam[i] = last_centers[i]

                        H, mask = cv2.findHomography(pts_cam, pts_proj, cv2.RANSAC, 5.0)
                        if H is None:
                            print("findHomography вернул None.", file=sys.stderr)
                            continue
                        H_inv = np.linalg.inv(H)

                        payload = {
                            "version": 1,
                            "method": "apriltag_centers",
                            "detector_backend": args.backend,
                            "tag_family": TAG_FAMILY,
                            "tag_ids": list(TAG_IDS),
                            "proj_resolution": [proj_w, proj_h],
                            "camera_index": args.camera
                            if isinstance(args.camera, int)
                            else str(args.camera),
                            "camera_resolution": [aw, ah],
                            "flip_horizontal": args.flip,
                            "margin_px": margin,
                            "tag_size_px": tag_sz,
                            "tag_center_offset_in_cell_xy": [cx, cy],
                            "H_cam_to_proj": H.tolist(),
                            "H_proj_to_cam": H_inv.tolist(),
                            "inliers_homography": int(mask.sum())
                            if mask is not None
                            else None,
                        }
                        with open(args.output, "w", encoding="utf-8") as f:
                            json.dump(payload, f, indent=2, ensure_ascii=False)
                        print(f"Сохранено: {args.output.resolve()}", file=sys.stderr)
                        running = False

            clock.tick(30)
    finally:
        cap.release()
        pygame.quit()


if __name__ == "__main__":
    main()
