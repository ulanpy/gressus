from __future__ import annotations

import math

import cv2
import numpy as np
import pygame

from .models import FallingTile


def label_surface(
    text: str,
    scale: float,
    color: tuple[int, int, int],
    thickness: int,
) -> pygame.Surface:
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


def rounded_label_surface(
    text: str,
    size: int,
    color: tuple[int, int, int],
) -> pygame.Surface:
    scale = max(0.6, size / 42.0)
    thickness = max(2, int(size / 17))
    font = cv2.FONT_HERSHEY_DUPLEX
    (tw, th), baseline = cv2.getTextSize(text, font, scale, thickness)
    pad = max(8, thickness * 3)
    h = th + baseline + pad * 2
    w = tw + pad * 2
    alpha = np.zeros((h, w), dtype=np.uint8)
    cv2.putText(alpha, text, (pad, pad + th), font, scale, 255, thickness + 2, cv2.LINE_AA)
    cv2.putText(alpha, text, (pad, pad + th), font, scale, 255, thickness, cv2.LINE_AA)
    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    rgba[..., 0] = color[0]
    rgba[..., 1] = color[1]
    rgba[..., 2] = color[2]
    rgba[..., 3] = alpha
    surf = pygame.image.frombuffer(rgba.tobytes(), (w, h), "RGBA")
    return surf.convert_alpha()


def hud_surface(lines: list[str], *, fg_color: tuple[int, int, int]) -> pygame.Surface:
    fs, th, pad = 0.65, 26, 12
    max_w = 0
    for line in lines:
        (tw, _), _ = cv2.getTextSize(line, cv2.FONT_HERSHEY_SIMPLEX, fs, 1)
        max_w = max(max_w, tw)
    h = pad * 2 + len(lines) * th
    w = max(520, pad * 2 + max_w + 8)
    img = np.zeros((h, w, 3), dtype=np.uint8)
    cv2.rectangle(img, (0, 0), (w - 1, h - 1), fg_color, 1)
    for i, line in enumerate(lines):
        cv2.putText(
            img,
            line,
            (pad, pad + 20 + i * th),
            cv2.FONT_HERSHEY_SIMPLEX,
            fs,
            fg_color,
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


def _clamp_u8(v: float) -> int:
    return max(0, min(255, int(v)))


def _blend(
    a: tuple[int, int, int],
    b: tuple[int, int, int],
    t: float,
) -> tuple[int, int, int]:
    t = max(0.0, min(1.0, t))
    return (
        _clamp_u8(a[0] + (b[0] - a[0]) * t),
        _clamp_u8(a[1] + (b[1] - a[1]) * t),
        _clamp_u8(a[2] + (b[2] - a[2]) * t),
    )


def _draw_soft_rect(
    surface: pygame.Surface,
    rect: pygame.Rect,
    color: tuple[int, int, int],
    alpha: int,
    radius: int,
    width: int = 0,
) -> None:
    if rect.width <= 0 or rect.height <= 0 or alpha <= 0:
        return
    pad = max(radius, width + 2)
    layer = pygame.Surface((rect.width + pad * 2, rect.height + pad * 2), pygame.SRCALPHA)
    draw_rect = pygame.Rect(pad, pad, rect.width, rect.height)
    pygame.draw.rect(layer, (*color, alpha), draw_rect, width=width, border_radius=radius)
    surface.blit(layer, (rect.left - pad, rect.top - pad))


def _draw_star(
    surface: pygame.Surface,
    cx: float,
    cy: float,
    outer_r: float,
    color: tuple[int, int, int],
    alpha: int,
    angle: float,
) -> None:
    if outer_r <= 1 or alpha <= 0:
        return
    size = int(outer_r * 3)
    layer = pygame.Surface((size, size), pygame.SRCALPHA)
    mid = size / 2
    points = []
    for i in range(10):
        r = outer_r if i % 2 == 0 else outer_r * 0.48
        a = angle + i * math.pi / 5.0
        points.append((mid + math.cos(a) * r, mid + math.sin(a) * r))
    pygame.draw.polygon(layer, (*color, alpha), points)
    surface.blit(layer, (int(cx - mid), int(cy - mid)))


def _draw_footprint_icon(
    surface: pygame.Surface,
    rect: pygame.Rect,
    color: tuple[int, int, int],
    alpha: int,
    scale: float = 1.0,
) -> None:
    if alpha <= 0:
        return
    icon_w = max(44, int(rect.width * 0.22 * scale))
    icon_h = max(70, int(rect.height * 0.34 * scale))
    layer = pygame.Surface((icon_w, icon_h), pygame.SRCALPHA)
    cx = icon_w // 2
    sole_w = max(18, int(icon_w * 0.34))
    sole_h = max(34, int(icon_h * 0.48))
    heel_w = max(14, int(icon_w * 0.26))
    heel_h = max(18, int(icon_h * 0.26))

    sole = pygame.Rect(0, 0, sole_w, sole_h)
    sole.center = (cx, int(icon_h * 0.56))
    heel = pygame.Rect(0, 0, heel_w, heel_h)
    heel.center = (cx, int(icon_h * 0.80))

    pygame.draw.ellipse(layer, (*color, alpha), sole)
    pygame.draw.ellipse(layer, (*color, alpha), heel)
    for i, toe_scale in enumerate((1.0, 0.85, 0.72, 0.62, 0.55)):
        toe_r = max(3, int(icon_w * 0.075 * toe_scale))
        toe_x = cx - int(icon_w * 0.22) + int(i * icon_w * 0.11)
        toe_y = int(icon_h * (0.16 + abs(i - 1) * 0.025))
        pygame.draw.circle(layer, (*color, alpha), (toe_x, toe_y), toe_r)

    surface.blit(layer, (rect.centerx - icon_w // 2, rect.centery - icon_h // 2))


def _draw_pad_shadow(surface: pygame.Surface, rect: pygame.Rect, strength: float = 1.0) -> None:
    shadow = rect.copy()
    shadow.y += max(10, rect.height // 18)
    shadow.height = max(8, int(rect.height * 0.24))
    shadow.centery = rect.bottom - shadow.height // 3
    _draw_soft_rect(
        surface,
        shadow.inflate(int(rect.width * 0.07), int(rect.height * 0.10)),
        (0, 0, 0),
        int(88 * strength),
        max(18, rect.height // 7),
    )
    _draw_soft_rect(
        surface,
        shadow.inflate(int(rect.width * 0.18), int(rect.height * 0.18)),
        (0, 0, 0),
        int(34 * strength),
        max(24, rect.height // 5),
    )


def _draw_base_tile(
    surface: pygame.Surface,
    rect: pygame.Rect,
    pulse: float,
    accent: tuple[int, int, int],
) -> None:
    radius = max(16, min(rect.width, rect.height) // 9)
    glow = 0.55 + 0.45 * pulse
    soft = _blend(accent, (255, 255, 255), 0.24)
    body_dark = _blend(accent, (12, 28, 52), 0.35)
    body_light = _blend(accent, (210, 250, 255), 0.42)
    edge = _blend(accent, (245, 255, 255), 0.52)

    _draw_pad_shadow(surface, rect, 0.82)
    _draw_soft_rect(surface, rect.inflate(22, 18), accent, int(32 * glow), radius + 16)
    _draw_soft_rect(surface, rect.inflate(10, 8), soft, int(46 * glow), radius + 8, width=3)

    body = _blend(body_dark, body_light, 0.35 + 0.25 * pulse)
    pygame.draw.rect(surface, body, rect, border_radius=radius)
    pygame.draw.rect(surface, edge, rect, width=2, border_radius=radius)

    inner = rect.inflate(-14, -14)
    pygame.draw.rect(surface, soft, inner, width=1, border_radius=max(8, radius - 8))
    _draw_footprint_icon(surface, rect, (230, 255, 255), int(70 + 35 * pulse), 0.95)


def _draw_ready_tile(
    surface: pygame.Surface,
    rect: pygame.Rect,
    pulse: float,
    now: float,
    accent: tuple[int, int, int],
) -> None:
    radius = max(18, min(rect.width, rect.height) // 8)
    glow = 0.75 + 0.25 * pulse
    neon = _blend(accent, (255, 255, 255), 0.18)
    body_dark = _blend(accent, (18, 34, 70), 0.22)
    body_light = _blend(accent, (245, 245, 255), 0.52)
    _draw_pad_shadow(surface, rect, 1.0)
    _draw_soft_rect(surface, rect.inflate(46, 34), accent, int(64 * glow), radius + 24)
    _draw_soft_rect(surface, rect.inflate(24, 18), neon, int(90 * glow), radius + 14, width=5)

    body = _blend(body_dark, body_light, 0.45 + 0.35 * pulse)
    pygame.draw.rect(surface, body, rect, border_radius=radius)
    pygame.draw.rect(surface, (220, 255, 255), rect, width=3, border_radius=radius)
    pygame.draw.rect(surface, neon, rect.inflate(8, 8), width=4, border_radius=radius + 6)
    _draw_footprint_icon(surface, rect, (255, 255, 255), int(145 + 80 * pulse), 1.08)

    for i in range(14):
        side = i % 4
        phase = now * 2.5 + i * 1.37
        travel = (math.sin(phase) + 1.0) * 0.5
        if side == 0:
            x = rect.left + travel * rect.width
            y = rect.top - 8 + math.cos(phase) * 4
        elif side == 1:
            x = rect.right + 8 + math.cos(phase) * 4
            y = rect.top + travel * rect.height
        elif side == 2:
            x = rect.right - travel * rect.width
            y = rect.bottom + 8 + math.cos(phase) * 4
        else:
            x = rect.left - 8 + math.cos(phase) * 4
            y = rect.bottom - travel * rect.height
        sparkle_alpha = int(120 + 100 * ((math.sin(phase * 1.7) + 1.0) * 0.5))
        _draw_star(surface, x, y, 5 + 2 * pulse, (245, 255, 255), sparkle_alpha, phase)


def _draw_pressed_tile(
    surface: pygame.Surface,
    rect: pygame.Rect,
    age: float,
) -> None:
    duration = 0.9
    progress = max(0.0, min(1.0, age / duration))
    alpha = int(255 * (1.0 - progress))
    radius = max(18, min(rect.width, rect.height) // 8)

    compressed = rect.inflate(-int(rect.width * 0.05), -int(rect.height * 0.18))
    compressed.centery = rect.centery + int(rect.height * 0.04)
    _draw_pad_shadow(surface, compressed, 0.72 * (1.0 - progress * 0.35))
    _draw_soft_rect(surface, compressed.inflate(28, 22), (255, 236, 148), int(alpha * 0.55), radius + 16)
    pygame.draw.rect(surface, (244, 255, 255), compressed, border_radius=radius)
    pygame.draw.rect(surface, (255, 216, 90), compressed, width=4, border_radius=radius)
    _draw_footprint_icon(surface, compressed, (255, 218, 90), int(alpha * 0.85), 0.9)

    cx, cy = rect.center
    ripple_r = int((0.25 + progress * 1.15) * max(rect.width, rect.height))
    ripple_alpha = int(180 * (1.0 - progress))
    if ripple_alpha > 0:
        pygame.draw.circle(surface, (255, 244, 188), (cx, cy), ripple_r, width=5)
        _draw_soft_rect(surface, pygame.Rect(cx - ripple_r, cy - ripple_r, ripple_r * 2, ripple_r * 2), (255, 255, 255), int(ripple_alpha * 0.18), ripple_r, width=4)

    for i in range(18):
        angle = i * (math.tau / 18.0) + progress * 1.4
        speed = 0.45 + (i % 5) * 0.13
        dist = progress * max(rect.width, rect.height) * speed
        wobble = math.sin(progress * 7.0 + i) * 8.0
        x = cx + math.cos(angle) * (dist + wobble)
        y = cy + math.sin(angle) * (dist + wobble)
        star_color = (255, 224, 96) if i % 3 else (255, 255, 255)
        star_size = 12 + (i % 4) * 3
        _draw_star(surface, x, y, star_size * (1.0 - progress * 0.35), star_color, alpha, angle + progress * 5.0)
        trail_x = cx + math.cos(angle) * dist * 0.62
        trail_y = cy + math.sin(angle) * dist * 0.62
        pygame.draw.circle(surface, (255, 248, 210), (int(trail_x), int(trail_y)), max(1, int(4 * (1.0 - progress))))

    for i in range(28):
        angle = i * (math.tau / 28.0) + math.sin(i) * 0.35
        dist = progress * max(rect.width, rect.height) * (0.25 + (i % 7) * 0.09)
        x = cx + math.cos(angle) * dist
        y = cy + math.sin(angle) * dist
        pygame.draw.circle(surface, (124, 232, 255), (int(x), int(y)), max(1, int(5 * (1.0 - progress))),)


def _rainbow_color(t: float) -> tuple[int, int, int]:
    r = math.sin(t) * 0.5 + 0.5
    g = math.sin(t + math.tau / 3.0) * 0.5 + 0.5
    b = math.sin(t + math.tau * 2.0 / 3.0) * 0.5 + 0.5
    return (_clamp_u8(120 + r * 135), _clamp_u8(120 + g * 135), _clamp_u8(120 + b * 135))


def _draw_combo_bar(
    surface: pygame.Surface,
    *,
    now: float,
    combo_count: int,
    combo_burst_age: float | None,
) -> None:
    progress = max(0.0, min(1.0, combo_count / 10.0))
    w = min(720, int(surface.get_width() * 0.58))
    h = max(28, min(44, surface.get_height() // 22))
    x = surface.get_width() // 2 - w // 2
    y = max(16, surface.get_height() // 42)
    rect = pygame.Rect(x, y, w, h)
    radius = h // 2

    glow = 0.25 + progress * 0.9
    if combo_burst_age is not None:
        burst_pulse = max(0.0, 1.0 - combo_burst_age / 0.8)
        glow += burst_pulse * 0.8

    _draw_soft_rect(surface, rect.inflate(30, 20), (0, 230, 255), int(70 * glow), radius + 14)
    pygame.draw.rect(surface, (12, 28, 42), rect, border_radius=radius)
    pygame.draw.rect(surface, (94, 210, 255), rect, width=3, border_radius=radius)

    fill_w = int(w * progress)
    if fill_w > 0:
        fill_rect = pygame.Rect(x, y, fill_w, h)
        fill_color = _blend((38, 190, 245), (255, 225, 92), progress)
        pygame.draw.rect(surface, fill_color, fill_rect, border_radius=radius)
        _draw_soft_rect(surface, fill_rect.inflate(8, 8), fill_color, int(44 + 70 * progress), radius + 4)

        shine = pygame.Rect(x + 8, y + 5, max(0, fill_w - 16), max(4, h // 4))
        _draw_soft_rect(surface, shine, (255, 255, 255), int(70 + progress * 80), shine.height // 2)

    sparkle_area_w = max(1, fill_w)
    sparkle_count = 5 + int(progress * 20)
    for i in range(sparkle_count):
        phase = now * (1.4 + (i % 5) * 0.22) + i * 0.73
        sx = x + ((phase * 70 + i * 41) % sparkle_area_w)
        sy = y + h * (0.25 + 0.5 * ((math.sin(phase * 1.9) + 1.0) * 0.5))
        alpha = int((80 + 130 * progress) * (0.55 + 0.45 * math.sin(phase * 2.3) ** 2))
        _draw_star(surface, sx, sy, 3.0 + progress * 3.0, (245, 255, 255), alpha, phase)

    tick_w = w / 10.0
    for i in range(1, 10):
        tx = int(x + i * tick_w)
        pygame.draw.line(surface, (95, 155, 170), (tx, y + 7), (tx, y + h - 7), 1)


def _draw_combo_celebration(
    surface: pygame.Surface,
    *,
    now: float,
    age: float | None,
) -> None:
    if age is None:
        return
    duration = 1.45
    progress = max(0.0, min(1.0, age / duration))
    if progress >= 1.0:
        return

    fade = 1.0 - progress
    w, h = surface.get_size()
    cx, cy = w // 2, int(h * 0.55)

    glow_alpha = int(95 * fade)
    if glow_alpha > 0:
        overlay = pygame.Surface((w, h), pygame.SRCALPHA)
        overlay.fill((255, 245, 190, glow_alpha))
        surface.blit(overlay, (0, 0))

    for ring in range(3):
        ring_progress = max(0.0, min(1.0, progress * 1.25 - ring * 0.15))
        if ring_progress <= 0.0:
            continue
        radius = int((0.15 + ring_progress * 0.95) * max(w, h))
        color = _rainbow_color(now * 2.0 + ring * 1.8)
        pygame.draw.circle(surface, color, (cx, cy), radius, width=max(3, int(10 * fade)))

    for i in range(44):
        angle = i * (math.tau / 44.0) + progress * 1.1
        speed = 0.25 + (i % 9) * 0.08
        dist = progress * max(w, h) * speed
        x = cx + math.cos(angle) * dist
        y = cy + math.sin(angle) * dist * 0.72
        color = _rainbow_color(i * 0.8 + progress * 5.0)
        size = 9 + (i % 6) * 4
        _draw_star(surface, x, y, size * (0.65 + 0.35 * fade), color, int(230 * fade), angle + now * 2.0)

    for i in range(90):
        phase = now * 1.7 + i * 0.51
        spread = progress * max(w, h) * (0.2 + (i % 13) * 0.035)
        angle = i * 2.399 + progress * 0.5
        x = cx + math.cos(angle) * spread
        y = cy + math.sin(angle) * spread * 0.78 + math.sin(phase) * 16
        color = _rainbow_color(phase)
        pygame.draw.circle(surface, color, (int(x), int(y)), max(1, int((5 + i % 4) * fade)))


def _draw_idle_background_magic(
    surface: pygame.Surface,
    *,
    now: float,
    rects: list[pygame.Rect],
    lane_colors: tuple[tuple[int, int, int], tuple[int, int, int]],
) -> None:
    w, h = surface.get_size()
    for i in range(80):
        lane = i % len(rects)
        rect = rects[lane]
        accent = lane_colors[lane]
        phase = now * (0.18 + (i % 7) * 0.018) + i * 1.713
        x_base = rect.left + rect.width * (0.12 + 0.76 * (((i * 37) % 100) / 100.0))
        y_base = ((i * 83) % max(1, h + 180)) - 90
        x = x_base + math.sin(phase * 1.7) * rect.width * 0.035
        y = (y_base + now * (8 + (i % 5) * 2.0)) % (h + 120) - 60
        pulse = (math.sin(phase * 3.1) + 1.0) * 0.5
        radius = 1.2 + (i % 4) * 0.45 + pulse * 0.8
        alpha = int(20 + pulse * 46)
        color = _blend(accent, (255, 255, 255), 0.42)
        pygame.draw.circle(surface, color, (int(x), int(y)), max(1, int(radius)))
        if i % 5 == 0:
            _draw_star(
                surface,
                x,
                y,
                3.0 + pulse * 2.0,
                _blend(accent, (255, 255, 255), 0.72),
                alpha,
                phase,
            )


def draw_scene(
    screen: pygame.Surface,
    *,
    now: float,
    scr_w: int,
    play_top: int,
    play_bottom: int,
    hit_y: int,
    hit_window: int,
    tiles: list[FallingTile],
    lane_names: tuple[str, str],
    lane_colors: tuple[tuple[int, int, int], tuple[int, int, int]],
    bg_color: tuple[int, int, int],
    fg_color: tuple[int, int, int],
    center_hit_radius_frac: float,
    combo_count: int = 0,
    combo_burst_age: float | None = None,
) -> None:
    screen.fill(bg_color)
    rects = lane_rects(scr_w, play_top, play_bottom)
    for i, rect in enumerate(rects):
        lane_fill = _blend(bg_color, lane_colors[i], 0.04)
        lane_edge = _blend(lane_colors[i], (255, 255, 255), 0.45)
        pygame.draw.rect(screen, lane_fill, rect)
        pygame.draw.rect(screen, lane_edge, rect, width=2)
    _draw_idle_background_magic(
        screen,
        now=now,
        rects=rects,
        lane_colors=lane_colors,
    )
    for i, rect in enumerate(rects):
        lane_edge = _blend(lane_colors[i], (255, 255, 255), 0.45)
        tag = rounded_label_surface(lane_names[i], max(34, rect.width // 26), lane_edge)
        screen.blit(tag, (rect.centerx - tag.get_width() // 2, play_top + 8))

    pygame.draw.line(screen, fg_color, (0, hit_y), (scr_w, hit_y), 4)
    pygame.draw.line(screen, (100, 100, 100), (0, hit_y - hit_window), (scr_w, hit_y - hit_window), 1)
    pygame.draw.line(screen, (100, 100, 100), (0, hit_y + hit_window), (scr_w, hit_y + hit_window), 1)

    for tile in tiles:
        r_lane = rects[tile.lane]
        pad_x = max(8, r_lane.width // 12)
        t_rect = pygame.Rect(r_lane.left + pad_x, int(tile.y), r_lane.width - 2 * pad_x, tile.h)
        if t_rect.bottom < play_top or t_rect.top > play_bottom:
            continue

        tile_center_y = t_rect.centery
        ready = abs(tile_center_y - hit_y) <= hit_window * 0.72
        pulse_t = now - tile.spawn_t
        pulse = (math.sin(pulse_t * (5.8 if ready else 3.0)) + 1.0) * 0.5
        if tile.hit:
            _draw_pressed_tile(screen, t_rect, max(0.0, now - tile.hit_t))
        elif ready:
            _draw_ready_tile(screen, t_rect, pulse, now, lane_colors[tile.lane])
        else:
            _draw_base_tile(screen, t_rect, pulse, lane_colors[tile.lane])

        if tile.note:
            txt = label_surface(tile.note, 0.9, fg_color, 2)
            screen.blit(txt, (t_rect.centerx - txt.get_width() // 2, t_rect.centery - txt.get_height() // 2))

    _draw_combo_celebration(screen, now=now, age=combo_burst_age)
    _draw_combo_bar(
        screen,
        now=now,
        combo_count=combo_count,
        combo_burst_age=combo_burst_age,
    )
