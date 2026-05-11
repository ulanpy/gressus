from __future__ import annotations

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


def draw_scene(
    screen: pygame.Surface,
    *,
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
) -> None:
    screen.fill(bg_color)
    rects = lane_rects(scr_w, play_top, play_bottom)
    for i, rect in enumerate(rects):
        pygame.draw.rect(screen, (20, 20, 24), rect)
        pygame.draw.rect(screen, fg_color, rect, width=2)
        tag = label_surface(lane_names[i], 1.2, fg_color, 2)
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
        color = lane_colors[tile.lane]
        if tile.hit:
            color = (255, 255, 255)
        pygame.draw.rect(screen, color, t_rect, border_radius=10)
        pygame.draw.rect(screen, fg_color, t_rect, width=3, border_radius=10)
        txt = label_surface(tile.note, 0.9, fg_color, 2)
        screen.blit(txt, (t_rect.centerx - txt.get_width() // 2, t_rect.centery - txt.get_height() // 2))

