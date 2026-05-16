#!/usr/bin/env python3
"""
Визуализация давления Insolex/WaveX: JSONL как у `scripts/listener.py`; координаты — см. `--size`
(`src/insole_sensors_m.py` или `src/insole_sensors_s.py`).

Запуск (после того как Windows-bridge уже шлёт в listener):
    poetry run python scripts/listener.py 0.0.0.0 9100 \\
      | QT_QPA_PLATFORM=xcb poetry run python scripts/insole_pressure_viz.py

Без стелек (мок для отладки дизайна):
    QT_QPA_PLATFORM=xcb poetry run python scripts/insole_pressure_viz.py --mock

Или из файла:
    QT_QPA_PLATFORM=xcb poetry run python scripts/insole_pressure_viz.py \\
      < dumps.jsonl

Пакеты: только numpy + pygame (уже в pyproject.toml). json — stdlib.

Поля JSON ожидаются как в docstring `scripts/listener.py` (L/R: list[list[float]] кПа, 64 точки за скан).
"""

from __future__ import annotations

import argparse
import json
import os
import queue
import sys
import threading
import time
from pathlib import Path

if os.environ.get("WAYLAND_DISPLAY") and not os.environ.get("QT_QPA_PLATFORM"):
    os.environ["QT_QPA_PLATFORM"] = "xcb"

import cv2
import numpy as np
import pygame

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.insole_stream import N_SENSORS, latest_scan  # noqa: E402

GRID_W = 48
GRID_H = 128
COLOR_LUT_SIZE = 256


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


_PRESSURE_STOPS = (
    (0.00, np.array([232, 239, 248], dtype=np.float32)),
    (0.18, np.array([154, 214, 244], dtype=np.float32)),
    (0.42, np.array([78, 194, 176], dtype=np.float32)),
    (0.68, np.array([255, 225, 111], dtype=np.float32)),
    (0.86, np.array([255, 157, 73], dtype=np.float32)),
    (1.00, np.array([236, 78, 55], dtype=np.float32)),
)


def _build_color_lut(size: int = COLOR_LUT_SIZE) -> np.ndarray:
    lut = np.zeros((size, 3), dtype=np.uint8)
    for i in range(size):
        t = i / max(size - 1, 1)
        for (t0, c0), (t1, c1) in zip(_PRESSURE_STOPS, _PRESSURE_STOPS[1:]):
            if t <= t1:
                a = (t - t0) / max(t1 - t0, 1e-6)
                c = c0 + (c1 - c0) * a
                lut[i] = np.clip(c, 0, 255).astype(np.uint8)
                break
        else:
            lut[i] = np.clip(_PRESSURE_STOPS[-1][1], 0, 255).astype(np.uint8)
    return lut


_COLOR_LUT = _build_color_lut()


def pressure_value_to_color(v_kpa: float, vmax: float) -> tuple[int, int, int]:
    t = float(np.clip(v_kpa / max(vmax, 1e-6), 0.0, 1.0))
    idx = int(round(t * (COLOR_LUT_SIZE - 1)))
    c = _COLOR_LUT[idx]
    return int(c[0]), int(c[1]), int(c[2])


def field_to_rgb(field: np.ndarray, vmax_kpa: float) -> np.ndarray:
    """field (H, W) кПа → RGB (H, W, 3)."""
    t = np.clip(field / max(vmax_kpa, 1e-6), 0.0, 1.0)
    idx = (t * (COLOR_LUT_SIZE - 1)).astype(np.uint8)
    return _COLOR_LUT[idx]


def finite_max(vals: np.ndarray | None) -> float:
    if vals is None or vals.size == 0:
        return 0.0
    clean = np.nan_to_num(vals, nan=0.0, posinf=0.0, neginf=0.0)
    return float(np.max(clean))


def mock_pressure_frame(
    coords_mm: tuple[tuple[float, float], ...],
    t_sec: float,
    *,
    phase_offset: float,
) -> np.ndarray:
    """Синтетическое давление: шаг с пяткой → серединой → носком."""
    coords = np.array(coords_mm[:N_SENSORS], dtype=np.float64)
    ymin = float(np.min(coords[:, 1]))
    ymax = float(np.max(coords[:, 1]))
    length = max(ymax - ymin, 1e-6)
    x_center = float(np.mean(coords[:, 0]))

    step = (t_sec * 1.05 + phase_offset) % 1.0
    if step < 0.32:
        hotspot_y = ymin + length * (0.10 + step * 1.05)
        sigma_y = length * 0.13
        peak = 175.0
    elif step < 0.68:
        hotspot_y = ymin + length * (0.48 + (step - 0.32) * 0.55)
        sigma_y = length * 0.17
        peak = 255.0
    else:
        hotspot_y = ymin + length * (0.78 + (step - 0.68) * 0.55)
        sigma_y = length * 0.11
        peak = 145.0

    dy = coords[:, 1] - hotspot_y
    dx = coords[:, 0] - x_center
    sigma_x = length * 0.21
    dist2 = (dy / sigma_y) ** 2 + (dx / sigma_x) ** 2
    vals = peak * np.exp(-0.5 * dist2)

    # лёгкий «шум» сенсора без random — детерминированно от времени
    wobble = 1.0 + 0.06 * np.sin(t_sec * 9.0 + coords[:, 0] * 0.11 + coords[:, 1] * 0.07)
    vals *= wobble
    vals = np.clip(vals, 0.0, None)
    return vals.astype(np.float64)


def mock_bridge_object(
    t_sec: float,
    left_mm: tuple[tuple[float, float], ...],
    right_mm: tuple[tuple[float, float], ...],
) -> dict:
    pl = mock_pressure_frame(left_mm, t_sec, phase_offset=0.0)
    pr = mock_pressure_frame(right_mm, t_sec, phase_offset=0.5)
    return {
        "seq": int(t_sec * 50),
        "dtMs": 20.0,
        "L_online": True,
        "R_online": True,
        "L": [pl.tolist()],
        "R": [pr.tolist()],
    }


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


def pressure_field_2d(
    coords_mm: tuple[tuple[float, float], ...],
    pressures: np.ndarray | None,
    *,
    sensor_side_mm: float,
    grid_w: int = GRID_W,
    grid_h: int = GRID_H,
) -> tuple[np.ndarray, float, float, float, float]:
    """Сглаженное поле давления (кПа) в мм-сетке для 2D-градиента."""
    coords = np.array(coords_mm[:N_SENSORS], dtype=np.float64)
    xmin, xmax, ymin, ymax = bbox_mm(coords_mm)
    pad = sensor_side_mm * 2.2
    xmin -= pad
    xmax += pad
    ymin -= pad
    ymax += pad

    xs = np.linspace(xmin, xmax, grid_w)
    ys = np.linspace(ymin, ymax, grid_h)
    xx, yy = np.meshgrid(xs, ys)

    vals = np.zeros(N_SENSORS, dtype=np.float64)
    if pressures is not None:
        n = min(N_SENSORS, len(pressures))
        vals[:n] = np.nan_to_num(pressures[:n], nan=0.0, posinf=0.0, neginf=0.0)

    sigma_mm = sensor_side_mm * 1.85
    weighted = np.zeros_like(xx, dtype=np.float64)
    weight = np.zeros_like(xx, dtype=np.float64)
    for (x_mm, y_mm), val in zip(coords, vals, strict=False):
        if val <= 0.0:
            continue
        d2 = (xx - x_mm) ** 2 + (yy - y_mm) ** 2
        w = np.exp(-d2 / (2.0 * sigma_mm * sigma_mm))
        weighted += w * val
        weight += w

    field = np.divide(weighted, weight + 1e-9)
    field = cv2.GaussianBlur(field.astype(np.float32), (0, 0), sigmaX=1.1, sigmaY=1.1)
    return field, xmin, xmax, ymin, ymax


def foot_2d_layout(
    rect: pygame.Rect,
    xmin: float,
    xmax: float,
    ymin: float,
    ymax: float,
) -> tuple[float, float, float]:
    w_mm = xmax - xmin
    h_mm = ymax - ymin
    scale = min(rect.width / max(w_mm, 1e-6), rect.height / max(h_mm, 1e-6)) * 0.92
    scale = max(scale, 0.1)
    ox = rect.x + (rect.width - w_mm * scale) * 0.5
    oy = rect.y + (rect.height - h_mm * scale) * 0.5
    return scale, ox, oy


def mm_to_screen(
    x_mm: float,
    y_mm: float,
    *,
    xmin: float,
    ymin: float,
    ymax: float,
    scale: float,
    ox: float,
    oy: float,
) -> tuple[int, int]:
    """Вид сверху: пятка (малый y) внизу, носок (большой y) вверху."""
    px = ox + (x_mm - xmin) * scale
    py = oy + (ymax - y_mm) * scale
    return int(round(px)), int(round(py))


def draw_foot_2d(
    surface: pygame.Surface,
    rect: pygame.Rect,
    coords_mm: tuple[tuple[float, float], ...],
    pressures: np.ndarray | None,
    vmax_kpa: float,
    *,
    sensor_side_mm: float,
) -> None:
    field, xmin, xmax, ymin, ymax = pressure_field_2d(
        coords_mm, pressures, sensor_side_mm=sensor_side_mm
    )
    scale, ox, oy = foot_2d_layout(rect, xmin, xmax, ymin, ymax)
    plot_w = max(1, int(round((xmax - xmin) * scale)))
    plot_h = max(1, int(round((ymax - ymin) * scale)))

    rgb = field_to_rgb(field, vmax_kpa).astype(np.float32)
    bg = np.array([248, 250, 252], dtype=np.float32)
    alpha = np.clip(field / max(vmax_kpa, 1e-6), 0.0, 1.0) ** 0.82
    rgb = (alpha[..., None] * rgb + (1.0 - alpha[..., None]) * bg).astype(np.uint8)
    # cv2: (rows, cols) = (y, x); пятка (малый y) — внизу экрана
    heat = cv2.resize(rgb, (plot_w, plot_h), interpolation=cv2.INTER_LINEAR)
    heat = cv2.flip(heat, 0)
    heat_surf = pygame.image.frombuffer(
        np.ascontiguousarray(heat).tobytes(),
        (plot_w, plot_h),
        "RGB",
    )

    dest = pygame.Rect(int(round(ox)), int(round(oy)), plot_w, plot_h)
    surface.blit(heat_surf, dest)

    coords = coords_mm[:N_SENSORS]
    vals = np.zeros(N_SENSORS, dtype=np.float64)
    if pressures is not None:
        n = min(N_SENSORS, len(pressures))
        vals[:n] = np.nan_to_num(pressures[:n], nan=0.0, posinf=0.0, neginf=0.0)

    dot_r = max(3, int(round(sensor_side_mm * scale * 0.38)))
    for (x_mm, y_mm), v in zip(coords, vals, strict=False):
        px, py = mm_to_screen(
            x_mm, y_mm, xmin=xmin, ymin=ymin, ymax=ymax, scale=scale, ox=ox, oy=oy
        )
        if v <= 0.15:
            color = (198, 208, 220)
        else:
            color = pressure_value_to_color(float(v), vmax_kpa)
        pygame.draw.circle(surface, color, (px, py), dot_r)
        pygame.draw.circle(surface, (90, 108, 128), (px, py), dot_r, width=1)


def draw_foot_panel(
    surface: pygame.Surface,
    rect: pygame.Rect,
    title: str,
    coords_mm: tuple[tuple[float, float], ...],
    pressures: np.ndarray | None,
    online: bool,
    vmax_kpa: float,
    thresh_kpa: float,
    *,
    sensor_side_mm: float,
    title_fg: tuple[int, int, int],
    mock: bool,
) -> None:
    pygame.draw.rect(surface, (255, 255, 255), rect)
    pygame.draw.rect(surface, (188, 198, 210), rect, width=2)
    tg = title_fg if (online or mock) else (185, 64, 64)
    suffix = "  [mock]" if mock else ""
    ttl = _text_surface([title + suffix], fg=tg, bg=(255, 255, 255))
    surface.blit(ttl, (rect.x + 12, rect.y + 8))
    draw_foot_2d(
        surface,
        rect.inflate(-16, -54).move(0, 22),
        coords_mm,
        pressures,
        vmax_kpa,
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
        "--mock",
        action="store_true",
        help="Синтетические L/R без stdin (для отладки визуализации без стелек).",
    )
    p.add_argument(
        "--max-kpa",
        type=float,
        default=350.0,
        help="Верх шкалы давления для цвета (кПа). Реальный максимум сглаженно может подтягивать шкалу.",
    )
    p.add_argument("--thresh-kpa", type=float, default=8.0, help="Порог «нажато» для кольца.")
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
    caption = f"Insole pressure ({args.size.upper()})"
    if args.mock:
        caption += " [mock]"
    pygame.display.set_caption(caption)
    clock = pygame.time.Clock()

    q_lines: queue.Queue[dict] = queue.Queue(maxsize=2)
    if not args.mock:
        t = threading.Thread(target=stdin_reader_lines, args=(q_lines,), daemon=True)
        t.start()

    last_obj: dict = {}
    vmax_dyn = args.max_kpa
    t0 = time.monotonic()

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

        if args.mock:
            last_obj = mock_bridge_object(time.monotonic() - t0, left_mm, right_mm)
        else:
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
            sensor_side_mm=sensor_side_mm,
            title_fg=(42, 125, 92),
            mock=args.mock,
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
            sensor_side_mm=sensor_side_mm,
            title_fg=(42, 125, 92),
            mock=args.mock,
        )

        seq = last_obj.get("seq", "?")
        dt_ms = last_obj.get("dtMs")
        src = "mock gait" if args.mock else "stdin JSONL"
        hud_surface = _text_surface(
            [
                f"size={args.size.upper()}  seq={seq}  dtMs={dt_ms if dt_ms is not None else '?'}  "
                f"vmax(scale)≈{scale_for_draw:.0f} kPa (cap {args.max_kpa:g})",
                f"2D pressure gradient ({src}) | Esc quit",
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
