#!/usr/bin/env python3
"""4 угла проекции на ленте: сдвигаем клавишами, сохраняем proj_quad в calibration.json."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import cv2
import numpy as np
import pygame

sys.path.insert(0, str(Path(__file__).resolve().parent))
import display_utils  # noqa: E402

LOGICAL_W = 1920
LOGICAL_H = 1080

CORNER_NAMES = ("TL", "TR", "BR", "BL")


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Подгонка 4 углов проекции (pre-warp) на ленте/стене."
    )
    p.add_argument(
        "-d",
        "--display",
        type=int,
        default=None,
        help="Индекс монитора pygame (часто 1 = HDMI-проектор).",
    )
    p.add_argument(
        "-o",
        "--output",
        type=Path,
        default=Path("config/calibration.json"),
        help="Куда сохранить/обновить JSON с квадом.",
    )
    p.add_argument(
        "--inset",
        type=float,
        default=0.0,
        help="Начальный отступ от краёв в долях (0..0.45). По умолчанию 0 — полный экран.",
    )
    return p.parse_args()


def make_grid_pattern(
    w: int,
    h: int,
    cell: int = 80,
    bg: tuple[int, int, int] = (20, 20, 20),
    fg: tuple[int, int, int] = (220, 220, 220),
    accent: tuple[int, int, int] = (80, 200, 120),
) -> np.ndarray:
    img = np.full((h, w, 3), bg, dtype=np.uint8)
    for x in range(0, w, cell):
        cv2.line(img, (x, 0), (x, h - 1), fg, 1, cv2.LINE_AA)
    for y in range(0, h, cell):
        cv2.line(img, (0, y), (w - 1, y), fg, 1, cv2.LINE_AA)
    cv2.rectangle(img, (0, 0), (w - 1, h - 1), accent, 6)
    cv2.line(img, (0, 0), (w - 1, h - 1), accent, 2, cv2.LINE_AA)
    cv2.line(img, (w - 1, 0), (0, h - 1), accent, 2, cv2.LINE_AA)
    cv2.circle(img, (w // 2, h // 2), 40, accent, 3, cv2.LINE_AA)
    pad = 30
    for label, (tx, ty) in zip(
        CORNER_NAMES,
        (
            (pad, pad + 22),
            (w - pad - 60, pad + 22),
            (w - pad - 60, h - pad),
            (pad, h - pad),
        ),
    ):
        cv2.putText(
            img, label, (tx, ty), cv2.FONT_HERSHEY_SIMPLEX, 1.0, accent, 2, cv2.LINE_AA
        )
    return img


def make_checker_pattern(w: int, h: int, cell: int = 120) -> np.ndarray:
    img = np.zeros((h, w, 3), dtype=np.uint8)
    for iy, y in enumerate(range(0, h, cell)):
        for ix, x in enumerate(range(0, w, cell)):
            c = (230, 230, 230) if (ix + iy) % 2 == 0 else (40, 40, 40)
            cv2.rectangle(img, (x, y), (x + cell - 1, y + cell - 1), c, -1)
    return img


def make_solid_pattern(w: int, h: int) -> np.ndarray:
    img = np.full((h, w, 3), (230, 230, 230), dtype=np.uint8)
    cv2.rectangle(img, (0, 0), (w - 1, h - 1), (80, 200, 120), 8)
    return img


PATTERN_MAKERS = (make_grid_pattern, make_checker_pattern, make_solid_pattern)
PATTERN_NAMES = ("grid", "checker", "solid")


def render_warped(
    pattern: np.ndarray, quad_dst: np.ndarray, screen_w: int, screen_h: int
) -> np.ndarray:
    lh, lw = pattern.shape[:2]
    src = np.array(
        [[0, 0], [lw - 1, 0], [lw - 1, lh - 1], [0, lh - 1]], dtype=np.float32
    )
    H = cv2.getPerspectiveTransform(src, quad_dst.astype(np.float32))
    return cv2.warpPerspective(
        pattern,
        H,
        (screen_w, screen_h),
        flags=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=(0, 0, 0),
    )


def bgr_to_surface(img_bgr: np.ndarray) -> pygame.Surface:
    rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    h, w = rgb.shape[:2]
    return pygame.image.frombuffer(rgb.tobytes(), (w, h), "RGB").convert()


def hud_surface(lines: list[str]) -> pygame.Surface:
    fs, th, pad = 0.6, 24, 10
    max_w = 0
    for line in lines:
        (tw, _), _ = cv2.getTextSize(line, cv2.FONT_HERSHEY_SIMPLEX, fs, 1)
        max_w = max(max_w, tw)
    h = pad * 2 + len(lines) * th
    w = max(420, pad * 2 + max_w + 8)
    img = np.full((h, w, 3), (35, 40, 55), dtype=np.uint8)
    for i, line in enumerate(lines):
        cv2.putText(
            img,
            line,
            (pad, pad + 18 + i * th),
            cv2.FONT_HERSHEY_SIMPLEX,
            fs,
            (220, 220, 230),
            1,
            cv2.LINE_AA,
        )
    return bgr_to_surface(img)


def load_existing(path: Path) -> dict:
    if not path.exists():
        return {}
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def save_output(
    path: Path, existing: dict, quad: np.ndarray, scr_w: int, scr_h: int
) -> None:
    merged = dict(existing)
    merged["proj_quad"] = [[int(round(x)), int(round(y))] for x, y in quad]
    merged["proj_quad_resolution"] = [scr_w, scr_h]
    merged["logical_size"] = [LOGICAL_W, LOGICAL_H]
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(merged, f, ensure_ascii=False, indent=2)


def initial_quad(
    existing: dict, scr_w: int, scr_h: int, inset: float
) -> np.ndarray:
    if "proj_quad" in existing and "proj_quad_resolution" in existing:
        q = np.array(existing["proj_quad"], dtype=np.float32)
        qw, qh = existing["proj_quad_resolution"]
        if qw > 0 and qh > 0 and (qw != scr_w or qh != scr_h):
            q[:, 0] *= scr_w / float(qw)
            q[:, 1] *= scr_h / float(qh)
        return q
    inset = max(0.0, min(0.45, inset))
    x0, y0 = inset * scr_w, inset * scr_h
    x1, y1 = scr_w - 1 - x0, scr_h - 1 - y0
    return np.array(
        [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], dtype=np.float32
    )


def main() -> None:
    args = parse_args()

    screen, scr_w, scr_h, _ = display_utils.open_fullscreen(
        args.display, "Projection quad adjust"
    )
    pygame.mouse.set_visible(False)

    existing = load_existing(args.output)
    quad = initial_quad(existing, scr_w, scr_h, args.inset)

    pattern_idx = 0
    pattern_cache: dict[int, np.ndarray] = {}

    def get_pattern(idx: int) -> np.ndarray:
        if idx not in pattern_cache:
            pattern_cache[idx] = PATTERN_MAKERS[idx](LOGICAL_W, LOGICAL_H)
        return pattern_cache[idx]

    sel = 0
    steps = (1, 5, 20)
    step_idx = 1
    saved_flash = 0.0

    clock = pygame.time.Clock()
    running = True
    try:
        while running:
            screen.fill((0, 0, 0))
            warped = render_warped(get_pattern(pattern_idx), quad, scr_w, scr_h)
            screen.blit(bgr_to_surface(warped), (0, 0))

            for i, (x, y) in enumerate(quad):
                xi, yi = int(round(x)), int(round(y))
                color = (255, 230, 80) if i == sel else (230, 230, 230)
                pygame.draw.circle(screen, (0, 0, 0), (xi, yi), 14)
                pygame.draw.circle(screen, color, (xi, yi), 10)
                pygame.draw.circle(screen, (0, 0, 0), (xi, yi), 3)

            step = steps[step_idx]
            lines = [
                f"corner: {CORNER_NAMES[sel]}  step: {step}px"
                f"  pattern: {PATTERN_NAMES[pattern_idx]}  screen: {scr_w}x{scr_h}",
                "1/2/3/4 select  hjkl / arrows move  Shift=x10  [ ] step"
                "  g pattern  r reset  Enter save  Esc quit",
                f"TL {quad[0, 0]:.0f},{quad[0, 1]:.0f}"
                f"  TR {quad[1, 0]:.0f},{quad[1, 1]:.0f}"
                f"  BR {quad[2, 0]:.0f},{quad[2, 1]:.0f}"
                f"  BL {quad[3, 0]:.0f},{quad[3, 1]:.0f}",
            ]
            hud = hud_surface(lines)
            screen.blit(hud, (scr_w // 2 - hud.get_width() // 2, 24))

            if saved_flash > 0:
                saved = hud_surface([f"Saved -> {args.output}"])
                screen.blit(
                    saved,
                    (
                        scr_w // 2 - saved.get_width() // 2,
                        scr_h - saved.get_height() - 24,
                    ),
                )

            pygame.display.flip()

            for e in pygame.event.get():
                if e.type == pygame.QUIT:
                    running = False
                elif e.type == pygame.KEYDOWN:
                    mods = pygame.key.get_mods()
                    big = bool(mods & pygame.KMOD_SHIFT)
                    s = step * (10 if big else 1)
                    k = e.key

                    if k in (pygame.K_ESCAPE, pygame.K_q):
                        running = False
                    elif k == pygame.K_1:
                        sel = 0
                    elif k == pygame.K_2:
                        sel = 1
                    elif k == pygame.K_3:
                        sel = 2
                    elif k == pygame.K_4:
                        sel = 3
                    elif k in (pygame.K_h, pygame.K_LEFT):
                        quad[sel, 0] -= s
                    elif k in (pygame.K_l, pygame.K_RIGHT):
                        quad[sel, 0] += s
                    elif k in (pygame.K_k, pygame.K_UP):
                        quad[sel, 1] -= s
                    elif k in (pygame.K_j, pygame.K_DOWN):
                        quad[sel, 1] += s
                    elif k == pygame.K_LEFTBRACKET:
                        step_idx = max(0, step_idx - 1)
                    elif k == pygame.K_RIGHTBRACKET:
                        step_idx = min(len(steps) - 1, step_idx + 1)
                    elif k == pygame.K_g:
                        pattern_idx = (pattern_idx + 1) % len(PATTERN_MAKERS)
                    elif k == pygame.K_r:
                        quad = np.array(
                            [
                                [0, 0],
                                [scr_w - 1, 0],
                                [scr_w - 1, scr_h - 1],
                                [0, scr_h - 1],
                            ],
                            dtype=np.float32,
                        )
                    elif k in (pygame.K_RETURN, pygame.K_s):
                        save_output(
                            args.output, load_existing(args.output), quad, scr_w, scr_h
                        )
                        saved_flash = 1.5

                    quad[:, 0] = np.clip(quad[:, 0], 0, scr_w - 1)
                    quad[:, 1] = np.clip(quad[:, 1], 0, scr_h - 1)

            saved_flash = max(0.0, saved_flash - 1.0 / 60.0)
            clock.tick(60)
    finally:
        pygame.quit()


if __name__ == "__main__":
    main()
