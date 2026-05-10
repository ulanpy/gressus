#!/usr/bin/env python3
"""
Визуализация давления Insolex/WaveX: JSONL как у listener.py; координаты — см. `--size`
(`src/insole_sensors_m.py` или `src/insole_sensors_s.py`).

Запуск (после того как Windows-bridge уже шлёт в listener):
    poetry run python listener.py 0.0.0.0 9100 \\
      | QT_QPA_PLATFORM=xcb poetry run python scripts/insole_pressure_viz.py

Или из файла:
    QT_QPA_PLATFORM=xcb poetry run python scripts/insole_pressure_viz.py \\
      < dumps.jsonl

Пакеты: только numpy + pygame (уже в pyproject.toml). json — stdlib.

Поля JSON ожидаются как в listener.py docstring (L/R: list[list[float]] кПа, 64 точки за скан).
"""

from __future__ import annotations

import argparse
import json
import os
import queue
import sys
import threading
from pathlib import Path

if os.environ.get("WAYLAND_DISPLAY") and not os.environ.get("QT_QPA_PLATFORM"):
    os.environ["QT_QPA_PLATFORM"] = "xcb"

import cv2
import numpy as np
import pygame

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.insole_stream import N_SENSORS, latest_scan  # noqa: E402

GRID_W = 36
GRID_H = 100
HEIGHT_GAMMA = 0.68


def _text_surface(
    lines: list[str],
    *,
    fg: tuple[int, int, int],
    bg: tuple[int, int, int],
) -> pygame.Surface:
    fs, th = 0.62, 24
    pad = 10
    max_w = 0
    for line in lines:
        (tw, _), _ = cv2.getTextSize(line, cv2.FONT_HERSHEY_SIMPLEX, fs, 1)
        max_w = max(max_w, tw)
    h_img = pad * 2 + len(lines) * th
    w_img = max_w + pad * 2 + 8
    img_bgr = np.full((h_img, w_img, 3), bg[::-1], dtype=np.uint8)
    for i, line in enumerate(lines):
        cv2.putText(
            img_bgr,
            line,
            (pad, pad + 18 + i * th),
            cv2.FONT_HERSHEY_SIMPLEX,
            fs,
            fg,
            1,
            cv2.LINE_AA,
        )
    rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    return pygame.image.frombuffer(rgb.tobytes(), (w_img, h_img), "RGB").convert()


def bbox_mm(coords: tuple[tuple[float, float], ...]) -> tuple[float, float, float, float]:
    xs = [c[0] for c in coords]
    ys = [c[1] for c in coords]
    return min(xs), max(xs), min(ys), max(ys)


def pressure_value_to_color(v_kpa: float, vmax: float) -> tuple[int, int, int]:
    t = float(np.clip(v_kpa / max(vmax, 1e-6), 0.0, 1.0))
    stops = (
        (0.00, np.array([232, 239, 248], dtype=np.float32)),
        (0.18, np.array([154, 214, 244], dtype=np.float32)),
        (0.42, np.array([78, 194, 176], dtype=np.float32)),
        (0.68, np.array([255, 225, 111], dtype=np.float32)),
        (0.86, np.array([255, 157, 73], dtype=np.float32)),
        (1.00, np.array([236, 78, 55], dtype=np.float32)),
    )
    for (t0, c0), (t1, c1) in zip(stops, stops[1:]):
        if t <= t1:
            a = (t - t0) / max(t1 - t0, 1e-6)
            c = c0 + (c1 - c0) * a
            return int(c[0]), int(c[1]), int(c[2])
    c = stops[-1][1]
    return int(c[0]), int(c[1]), int(c[2])


def finite_max(vals: np.ndarray | None) -> float:
    if vals is None or vals.size == 0:
        return 0.0
    clean = np.nan_to_num(vals, nan=0.0, posinf=0.0, neginf=0.0)
    return float(np.max(clean))


def anatomical_foot_mask(
    xx: np.ndarray,
    yy: np.ndarray,
    coords: np.ndarray,
    *,
    xmin: float,
    xmax: float,
    ymin: float,
    ymax: float,
    sensor_side_mm: float,
) -> np.ndarray:
    """Anatomical display outline with heel, medial arch and broad forefoot."""
    length = max(ymax - ymin, 1e-6)
    raw_width = max(float(np.max(coords[:, 0]) - np.min(coords[:, 0])), 1e-6)
    display_width = raw_width + sensor_side_mm * 3.2

    y_norm = (coords[:, 1] - np.min(coords[:, 1])) / max(
        float(np.max(coords[:, 1]) - np.min(coords[:, 1])),
        1e-6,
    )
    heel_center = float(np.mean(coords[y_norm <= 0.12, 0]))
    mid_candidates = coords[(y_norm >= 0.42) & (y_norm <= 0.62), 0]
    mid_center = float(np.mean(mid_candidates)) if mid_candidates.size else float(np.mean(coords[:, 0]))
    toe_center = float(np.mean(coords[y_norm >= 0.88, 0]))
    medial_sign = 1.0 if toe_center >= heel_center else -1.0

    v = np.clip((yy - ymin) / length, 0.0, 1.0)
    center = np.where(
        v < 0.62,
        heel_center + (mid_center - heel_center) * (v / 0.62),
        mid_center + (toe_center - mid_center) * ((v - 0.62) / 0.38),
    )

    profile_v = np.array([0.00, 0.06, 0.16, 0.32, 0.48, 0.62, 0.76, 0.89, 0.98, 1.00])
    lateral_profile = np.array([0.07, 0.20, 0.27, 0.30, 0.32, 0.39, 0.48, 0.47, 0.30, 0.10])
    medial_profile = np.array([0.08, 0.19, 0.23, 0.15, 0.12, 0.22, 0.47, 0.55, 0.39, 0.14])
    lateral_width = np.interp(v, profile_v, lateral_profile) * display_width
    medial_width = np.interp(v, profile_v, medial_profile) * display_width

    x_signed = (xx - center) * medial_sign
    basic = (x_signed >= -lateral_width) & (x_signed <= medial_width)

    heel_y = ymin + length * 0.075
    heel_rx = display_width * 0.25
    heel_ry = length * 0.095
    heel = ((xx - heel_center) / heel_rx) ** 2 + ((yy - heel_y) / heel_ry) ** 2 <= 1.0

    forefoot_y = ymin + length * 0.84
    forefoot = (
        ((xx - toe_center) / (display_width * 0.54)) ** 2
        + ((yy - forefoot_y) / (length * 0.145)) ** 2
        <= 1.0
    )

    big_toe_center_x = toe_center + medial_sign * display_width * 0.20
    toe_y = ymin + length * 0.955
    big_toe = (
        ((xx - big_toe_center_x) / (display_width * 0.24)) ** 2
        + ((yy - toe_y) / (length * 0.085)) ** 2
        <= 1.0
    )
    other_toes_center_x = toe_center - medial_sign * display_width * 0.12
    other_toes = (
        ((xx - other_toes_center_x) / (display_width * 0.34)) ** 2
        + ((yy - (toe_y - length * 0.015)) / (length * 0.070)) ** 2
        <= 1.0
    )

    return basic | heel | forefoot | big_toe | other_toes


def stdin_reader_lines(q_msg: queue.Queue[dict]) -> None:
    for raw in sys.stdin:
        raw = raw.strip()
        if not raw or raw.startswith("#"):
            continue
        try:
            obj = json.loads(raw)
            while True:
                try:
                    q_msg.get_nowait()
                except queue.Empty:
                    break
            q_msg.put_nowait(obj)
        except json.JSONDecodeError:
            continue


def pressure_field(
    coords_mm: tuple[tuple[float, float], ...],
    pressures: np.ndarray | None,
    *,
    sensor_side_mm: float,
    grid_w: int = GRID_W,
    grid_h: int = GRID_H,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    coords = np.array(coords_mm[:N_SENSORS], dtype=np.float64)
    xmin, xmax, ymin, ymax = bbox_mm(coords_mm)
    pad_mm = sensor_side_mm * 1.8
    xmin -= pad_mm
    xmax += pad_mm
    ymin -= pad_mm
    ymax += pad_mm

    xs = np.linspace(xmin, xmax, grid_w)
    ys = np.linspace(ymin, ymax, grid_h)
    xx, yy = np.meshgrid(xs, ys)

    sx = (grid_w - 1) / max(xmax - xmin, 1e-6)
    sy = (grid_h - 1) / max(ymax - ymin, 1e-6)
    radius = max(4, int(round(sensor_side_mm * 1.7 * min(sx, sy))))
    mask = anatomical_foot_mask(
        xx,
        yy,
        coords,
        xmin=xmin,
        xmax=xmax,
        ymin=ymin,
        ymax=ymax,
        sensor_side_mm=sensor_side_mm,
    )
    mask_img = (mask.astype(np.uint8) * 255)

    for x_mm, y_mm in coords:
        gx = int(round((x_mm - xmin) * sx))
        gy = int(round((y_mm - ymin) * sy))
        # Keep every physical sensor inside the display silhouette even if the
        # anatomical outline is a little narrower than the actual board layout.
        cv2.circle(mask_img, (gx, gy), radius, 255, -1, lineType=cv2.LINE_AA)

    kernel = np.ones((7, 7), dtype=np.uint8)
    mask_img = cv2.morphologyEx(mask_img, cv2.MORPH_CLOSE, kernel, iterations=2)
    mask_img = cv2.GaussianBlur(mask_img, (0, 0), sigmaX=1.0)
    mask = mask_img > 28

    vals = np.zeros(N_SENSORS, dtype=np.float64)
    if pressures is not None:
        n = min(N_SENSORS, len(pressures))
        vals[:n] = np.nan_to_num(pressures[:n], nan=0.0, posinf=0.0, neginf=0.0)

    sigma_mm = sensor_side_mm * 1.65
    weighted = np.zeros_like(xx, dtype=np.float64)
    weight = np.zeros_like(xx, dtype=np.float64)
    for (x_mm, y_mm), val in zip(coords, vals, strict=False):
        d2 = (xx - x_mm) ** 2 + (yy - y_mm) ** 2
        w = np.exp(-d2 / (2.0 * sigma_mm * sigma_mm))
        weighted += w * max(float(val), 0.0)
        weight += w

    field = np.divide(weighted, weight + 1e-9)
    field = cv2.GaussianBlur(field.astype(np.float32), (0, 0), sigmaX=0.8, sigmaY=0.8)
    field = np.where(mask, field, 0.0)
    return xs, ys, field, mask


def project_iso(
    x_mm: float,
    y_mm: float,
    z_px: float,
    *,
    xmin: float,
    xmax: float,
    ymin: float,
    ymax: float,
    scale: float,
    center: tuple[float, float],
) -> tuple[int, int]:
    x0 = x_mm - (xmin + xmax) * 0.5
    y0 = y_mm - (ymin + ymax) * 0.5
    px = center[0] + (x0 - y0 * 0.24) * scale
    py = center[1] - y0 * 0.34 * scale - z_px
    return int(round(px)), int(round(py))


def draw_foot_terrain(
    surface: pygame.Surface,
    rect: pygame.Rect,
    coords_mm: tuple[tuple[float, float], ...],
    pressures: np.ndarray | None,
    vmax_kpa: float,
    height_px: float,
    *,
    sensor_side_mm: float,
) -> None:
    xs, ys, field, mask = pressure_field(coords_mm, pressures, sensor_side_mm=sensor_side_mm)
    xmin, xmax = float(xs[0]), float(xs[-1])
    ymin, ymax = float(ys[0]), float(ys[-1])
    w_mm = xmax - xmin
    h_mm = ymax - ymin
    scale = min(
        rect.width * 0.78 / max(w_mm + h_mm * 0.24, 1e-6),
        (rect.height * 0.70 - height_px) / max(h_mm * 0.34, 1e-6),
    )
    scale = max(scale, 0.1)
    center = (rect.centerx, rect.y + rect.height * 0.61)

    contours, _ = cv2.findContours(
        mask.astype(np.uint8),
        cv2.RETR_EXTERNAL,
        cv2.CHAIN_APPROX_SIMPLE,
    )
    for contour in contours:
        if len(contour) < 3:
            continue
        poly: list[tuple[int, int]] = []
        for p in contour[:, 0, :]:
            j = int(np.clip(p[0], 0, len(xs) - 1))
            i = int(np.clip(p[1], 0, len(ys) - 1))
            poly.append(
                project_iso(
                    float(xs[j]),
                    float(ys[i]),
                    0.0,
                    xmin=xmin,
                    xmax=xmax,
                    ymin=ymin,
                    ymax=ymax,
                    scale=scale,
                    center=center,
                )
            )
        if len(poly) >= 3:
            pygame.draw.polygon(surface, (242, 247, 252), poly)
            pygame.draw.lines(surface, (144, 158, 176), True, poly, width=2)

    z = height_px * np.clip(field / max(vmax_kpa, 1e-6), 0.0, 1.0) ** HEIGHT_GAMMA
    for i in range(len(ys) - 2, -1, -1):
        for j in range(len(xs) - 1):
            if not (mask[i, j] or mask[i + 1, j] or mask[i, j + 1] or mask[i + 1, j + 1]):
                continue
            p00 = project_iso(
                xs[j],
                ys[i],
                z[i, j],
                xmin=xmin,
                xmax=xmax,
                ymin=ymin,
                ymax=ymax,
                scale=scale,
                center=center,
            )
            p10 = project_iso(
                xs[j + 1],
                ys[i],
                z[i, j + 1],
                xmin=xmin,
                xmax=xmax,
                ymin=ymin,
                ymax=ymax,
                scale=scale,
                center=center,
            )
            p11 = project_iso(
                xs[j + 1],
                ys[i + 1],
                z[i + 1, j + 1],
                xmin=xmin,
                xmax=xmax,
                ymin=ymin,
                ymax=ymax,
                scale=scale,
                center=center,
            )
            p01 = project_iso(
                xs[j],
                ys[i + 1],
                z[i + 1, j],
                xmin=xmin,
                xmax=xmax,
                ymin=ymin,
                ymax=ymax,
                scale=scale,
                center=center,
            )
            v = float(
                np.mean((field[i, j], field[i, j + 1], field[i + 1, j], field[i + 1, j + 1]))
            )
            if v <= 0.1:
                color = (232, 239, 248)
            else:
                color = pressure_value_to_color(v, vmax_kpa)
            pygame.draw.polygon(surface, color, (p00, p10, p11, p01))
            if v > 0.5:
                pygame.draw.lines(surface, (172, 186, 202), True, (p00, p10, p11, p01), width=1)


def draw_foot_panel(
    surface: pygame.Surface,
    rect: pygame.Rect,
    title: str,
    coords_mm: tuple[tuple[float, float], ...],
    pressures: np.ndarray | None,
    online: bool,
    vmax_kpa: float,
    thresh_kpa: float,
    height_px: float,
    *,
    sensor_side_mm: float,
    title_fg: tuple[int, int, int],
) -> None:
    pygame.draw.rect(surface, (255, 255, 255), rect)
    pygame.draw.rect(surface, (188, 198, 210), rect, width=2)
    tg = title_fg if online else (185, 64, 64)
    ttl = _text_surface([title], fg=tg, bg=(255, 255, 255))
    surface.blit(ttl, (rect.x + 12, rect.y + 8))
    draw_foot_terrain(
        surface,
        rect.inflate(-16, -54).move(0, 22),
        coords_mm,
        pressures,
        vmax_kpa,
        height_px,
        sensor_side_mm=sensor_side_mm,
    )

    if finite_max(pressures) >= thresh_kpa:
        ring = _text_surface(
            [f">= {thresh_kpa:.0f} kPa"],
            fg=(180, 110, 24),
            bg=(255, 255, 255),
        )
        surface.blit(ring, (rect.right - ring.get_width() - 12, rect.y + 8))


def running_vmax(vals: np.ndarray | None, cur: float, halflife: float) -> float:
    """Эксп. сглаживание максимума кадра (кПа) для шкалы цвета."""
    if vals is None or vals.size == 0:
        return cur
    m = float(np.nanmax(vals))
    if not np.isfinite(m) or m <= 0:
        return cur
    if cur <= 0:
        return m
    a = 1.0 - pow(0.5, halflife)
    return float(cur + a * max(0.0, m - cur))


def load_insole_geometry(size: str) -> tuple[tuple[tuple[float, float], ...], tuple[tuple[float, float], ...], float]:
    code = size.lower().strip()
    if code == "s":
        from src.insole_sensors_s import LEFT_MM, RIGHT_MM, SENSOR_SIDE_MM
    elif code == "m":
        from src.insole_sensors_m import LEFT_MM, RIGHT_MM, SENSOR_SIDE_MM
    else:
        raise SystemExit(f"Unknown --size {size!r}; use m or s")
    return LEFT_MM, RIGHT_MM, SENSOR_SIDE_MM


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Визуализация давления стельки из JSONL (stdin).")
    p.add_argument(
        "--size",
        choices=("m", "s"),
        default="m",
        help="Геометрия координат сенсоров: m — insole_sensors_m, s — insole_sensors_s.",
    )
    p.add_argument(
        "--max-kpa",
        type=float,
        default=350.0,
        help="Верх шкалы давления для цвета (кПа). Реальный максимум сглаженно может подтягивать шкалу.",
    )
    p.add_argument("--thresh-kpa", type=float, default=8.0, help="Порог «нажато» для кольца.")
    p.add_argument(
        "--height-px",
        type=float,
        default=130.0,
        help="Максимальная высота 3D-рельефа при давлении на верхе шкалы.",
    )
    p.add_argument(
        "--vmax-smooth",
        type=float,
        default=0.12,
        help="Сглаживание авто vmax (коэфф. ~ 0–1 по кадру). Чем меньше, тем резче шкала следует.",
    )
    return p.parse_args()


def main() -> None:
    args = parse_args()
    left_mm, right_mm, sensor_side_mm = load_insole_geometry(args.size)

    pygame.init()
    w, h = 1040, 560
    screen = pygame.display.set_mode((w, h))
    pygame.display.set_caption(f"Insole pressure ({args.size.upper()})")
    clock = pygame.time.Clock()

    q_lines: queue.Queue[dict] = queue.Queue(maxsize=2)
    t = threading.Thread(target=stdin_reader_lines, args=(q_lines,), daemon=True)
    t.start()

    last_obj: dict = {}
    vmax_dyn = args.max_kpa

    lw = (w // 2) - 28
    rect_l = pygame.Rect(16, 60, lw, h - 80)
    rect_r = pygame.Rect(16 + lw + 12, 60, lw, h - 80)

    running = True
    while running:
        for e in pygame.event.get():
            if e.type == pygame.QUIT:
                running = False
            elif e.type == pygame.KEYDOWN and e.key in (pygame.K_ESCAPE, pygame.K_q):
                running = False

        try:
            while True:
                last_obj = q_lines.get_nowait()
        except queue.Empty:
            pass

        pl, pr = latest_scan(last_obj)

        vmax_dyn = running_vmax(pl, vmax_dyn, args.vmax_smooth)
        vmax_dyn = running_vmax(pr, vmax_dyn, args.vmax_smooth)
        vmin_scale = args.max_kpa * 0.25
        scale_for_draw = float(max(min(vmax_dyn, args.max_kpa * 8), vmin_scale))

        screen.fill((238, 243, 248))

        l_on = bool(last_obj.get("L_online", pl is not None))
        r_on = bool(last_obj.get("R_online", pr is not None))
        draw_foot_panel(
            screen,
            rect_l,
            "LEFT",
            left_mm,
            pl,
            l_on,
            scale_for_draw,
            args.thresh_kpa,
            args.height_px,
            sensor_side_mm=sensor_side_mm,
            title_fg=(42, 125, 92),
        )
        draw_foot_panel(
            screen,
            rect_r,
            "RIGHT",
            right_mm,
            pr,
            r_on,
            scale_for_draw,
            args.thresh_kpa,
            args.height_px,
            sensor_side_mm=sensor_side_mm,
            title_fg=(42, 125, 92),
        )

        seq = last_obj.get("seq", "?")
        dt_ms = last_obj.get("dtMs")
        hud_surface = _text_surface(
            [
                f"size={args.size.upper()}  seq={seq}  dtMs={dt_ms if dt_ms is not None else '?'}  "
                f"vmax(scale)≈{scale_for_draw:.0f} kPa (cap {args.max_kpa:g})",
                "3D height map from stdin JSONL | height cap {:.0f}px | Esc quit".format(
                    args.height_px
                ),
            ],
            fg=(45, 55, 70),
            bg=(238, 243, 248),
        )
        screen.blit(hud_surface, (14, 12))

        pygame.display.flip()
        clock.tick(50)

    pygame.quit()


if __name__ == "__main__":
    main()
