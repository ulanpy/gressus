#!/usr/bin/env python3
"""Окклюзия на стене: фон по SPACE, затем absdiff → центроид → calibration.json → проектор. HUD сохранён."""

from __future__ import annotations

import argparse
import random
import sys
import time
from pathlib import Path

import cv2
import numpy as np
import pygame

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import display_utils  # noqa: E402
from src.calibration import CameraCalibration, load_calibration  # noqa: E402


def _parse_camera(s: str) -> int | str:
    s = s.strip()
    if s.startswith("/dev/"):
        return s
    return int(s) if s.isdigit() else s


def _configure_capture(
    cap: cv2.VideoCapture, width: int, height: int, mjpeg: bool
) -> None:
    if mjpeg:
        cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*"MJPG"))
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, float(width))
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, float(height))
    try:
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
    except Exception:
        pass
    for _ in range(6):
        cap.read()


def _hud_surface(lines: list[str]) -> pygame.Surface:
    fs, th = 0.55, 22
    pad = 8
    max_w = 0
    for line in lines:
        (tw, _), _ = cv2.getTextSize(line, cv2.FONT_HERSHEY_SIMPLEX, fs, 1)
        max_w = max(max_w, tw)
    h = pad * 2 + len(lines) * th
    w = max(320, pad * 2 + max_w + 8)
    img = np.full((h, w, 3), (0, 0, 0), dtype=np.uint8)
    cv2.rectangle(img, (0, 0), (w - 1, h - 1), (255, 255, 255), 1)
    for i, line in enumerate(lines):
        cv2.putText(
            img,
            line,
            (pad, pad + 16 + i * th),
            cv2.FONT_HERSHEY_SIMPLEX,
            fs,
            (255, 255, 255),
            1,
            cv2.LINE_AA,
        )
    rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    return pygame.image.frombuffer(rgb.tobytes(), (w, h), "RGB").convert()


def _largest_centroid(mask: np.ndarray, min_area: int) -> tuple[float, float] | None:
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    best = None
    best_a = 0
    for c in contours:
        a = cv2.contourArea(c)
        if a < min_area or a <= best_a:
            continue
        m = cv2.moments(c)
        if m["m00"] <= 1e-6:
            continue
        cx = m["m10"] / m["m00"]
        cy = m["m01"] / m["m00"]
        best = (cx, cy)
        best_a = a
    return best


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Окклюзия на стене: цель + трекинг силуэта.")
    p.add_argument(
        "--calibration",
        type=Path,
        default=Path("config/calibration.json"),
        help="JSON после calibrate_apriltag.py",
    )
    p.add_argument("-c", "--camera", type=_parse_camera, default="/dev/video2")
    p.add_argument("-d", "--display", type=int, default=None)
    p.add_argument("--width", type=int, default=1920)
    p.add_argument("--height", type=int, default=1080)
    p.add_argument("--no-mjpeg", action="store_true")
    p.add_argument(
        "--diff",
        type=int,
        default=28,
        help="Порог |кадр−фон| (0–255); выше — меньше шума, слабее силуэт.",
    )
    p.add_argument(
        "--min-area",
        type=int,
        default=12000,
        help="Мин. площадь контура (пикс^2); отсекает мелкий шум и маленькие блики.",
    )
    p.add_argument(
        "--hit-r",
        type=int,
        default=120,
        help="Радиус попадания в цель (пиксели экрана проектора).",
    )
    return p.parse_args()


def main() -> None:
    args = parse_args()
    cal: CameraCalibration = load_calibration(args.calibration)

    screen, scr_w, scr_h, _ = display_utils.open_fullscreen(
        args.display, "Occlusion wall game"
    )
    sx = scr_w / float(cal.proj_resolution[0])
    sy = scr_h / float(cal.proj_resolution[1])

    cap = cv2.VideoCapture(args.camera)
    if not cap.isOpened():
        print(f"Камера не открылась: {args.camera}", file=sys.stderr)
        sys.exit(1)
    _configure_capture(cap, args.width, args.height, not args.no_mjpeg)

    bg_gray: np.ndarray | None = None
    state = "wait_bg"
    score = 0
    target_px = scr_w // 2
    target_py = scr_h // 2
    last_flip = time.perf_counter()
    fps_ema = 0.0

    def new_target() -> None:
        nonlocal target_px, target_py
        m = 120
        target_px = random.randint(m, scr_w - m)
        target_py = random.randint(m, scr_h - m)

    new_target()
    clock = pygame.time.Clock()

    try:
        running = True
        while running:
            screen.fill((0, 0, 0))

            ok, frame = cap.read()
            player_screen: tuple[int, int] | None = None
            if ok and bg_gray is not None:
                gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                if cal.flip_horizontal:
                    gray = cv2.flip(gray, 1)
                g1 = cv2.GaussianBlur(gray, (15, 15), 0)
                g0 = cv2.GaussianBlur(bg_gray, (15, 15), 0)
                diff = cv2.absdiff(g0, g1)
                _, mask = cv2.threshold(diff, args.diff, 255, cv2.THRESH_BINARY)
                mask = cv2.morphologyEx(
                    mask, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8)
                )
                mask = cv2.morphologyEx(
                    mask, cv2.MORPH_CLOSE, np.ones((11, 11), np.uint8)
                )
                cen = _largest_centroid(mask, args.min_area)
                if cen is not None:
                    px, py = cal.cam_to_proj(cen[0], cen[1], frame.shape[1])
                    psx = px * sx
                    psy = py * sy
                    player_screen = (int(np.clip(psx, 0, scr_w - 1)), int(np.clip(psy, 0, scr_h - 1)))
                    if state == "play":
                        dist = np.hypot(player_screen[0] - target_px, player_screen[1] - target_py)
                        if dist < args.hit_r:
                            score += 1
                            new_target()

            if state == "wait_bg":
                pygame.draw.circle(screen, (255, 255, 255), (scr_w // 2, scr_h // 2), 22, 3)
                pygame.draw.circle(screen, (255, 255, 255), (scr_w // 2, scr_h // 2), 6)

            # High-contrast target for dark treadmill fabric.
            pygame.draw.circle(screen, (255, 220, 0), (target_px, target_py), 52)
            pygame.draw.circle(screen, (255, 255, 255), (target_px, target_py), 52, 5)
            pygame.draw.circle(screen, (255, 255, 255), (target_px, target_py), 16, 3)
            if player_screen is not None:
                pygame.draw.circle(screen, (0, 255, 255), player_screen, 46)
                pygame.draw.circle(screen, (255, 255, 255), player_screen, 46, 5)
                pygame.draw.circle(screen, (255, 255, 255), player_screen, 14, 3)

            dt = time.perf_counter() - last_flip
            if dt > 1e-6:
                inst = 1.0 / dt
                fps_ema = inst if fps_ema <= 0 else 0.85 * fps_ema + 0.15 * inst
            last_flip = time.perf_counter()

            hud = _hud_surface(
                [
                    f"state: {state}  score: {score}  fps: {fps_ema:.1f}",
                    "SPACE: capture empty wall bg | ESC: quit",
                ]
            )
            screen.blit(hud, (scr_w // 2 - hud.get_width() // 2, 24))

            pygame.display.flip()

            for e in pygame.event.get():
                if e.type == pygame.QUIT:
                    running = False
                elif e.type == pygame.KEYDOWN:
                    if e.key in (pygame.K_ESCAPE, pygame.K_q):
                        running = False
                    elif e.key == pygame.K_SPACE and state == "wait_bg":
                        frames = []
                        for _ in range(12):
                            ok2, f2 = cap.read()
                            if ok2:
                                g = cv2.cvtColor(f2, cv2.COLOR_BGR2GRAY)
                                if cal.flip_horizontal:
                                    g = cv2.flip(g, 1)
                                frames.append(g)
                        if frames:
                            bg_gray = np.mean(np.stack(frames, axis=0), axis=0).astype(
                                np.uint8
                            )
                            state = "play"
                    elif e.key == pygame.K_r and state == "play":
                        new_target()

            clock.tick(60)
    finally:
        cap.release()
        pygame.quit()


if __name__ == "__main__":
    main()
