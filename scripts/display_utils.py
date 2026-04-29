"""open_fullscreen() для pygame."""

from __future__ import annotations

import sys

import pygame


def pick_display_index(requested: int | None) -> int:
    pygame.display.init()
    n = pygame.display.get_num_displays()
    if n < 1:
        print("Нет доступных дисплеев для pygame.", file=sys.stderr)
        sys.exit(1)
    if requested is not None:
        if not (0 <= requested < n):
            print(
                f"Неверный --display {requested}: доступны индексы 0..{n - 1}.",
                file=sys.stderr,
            )
            sys.exit(1)
        return requested
    return n - 1


def open_fullscreen(
    display: int | None, caption: str
) -> tuple[pygame.Surface, int, int, int]:
    """
    Полноэкранное окно на выбранном дисплее.

    Returns:
        screen, width, height, display_index
    """
    d_index = pick_display_index(display)
    pygame.init()
    try:
        sizes = pygame.display.get_desktop_sizes()
    except Exception:
        sizes = []
    if d_index < len(sizes):
        w, h = sizes[d_index]
    else:
        w, h = 1920, 1080
    screen = pygame.display.set_mode((w, h), pygame.FULLSCREEN, display=d_index)
    pygame.display.set_caption(caption)
    return screen, w, h, d_index
