from __future__ import annotations

from .models import FallingTile


def screen_lane_of_point(x: float, lane_rects: list[tuple[float, float]]) -> int | None:
    for i, (left, right) in enumerate(lane_rects):
        if left <= x < right:
            return i
    return None


def point_inside_tile_y(y: float, tile: FallingTile) -> bool:
    return tile.y <= y <= (tile.y + tile.h)


def tile_overlaps_hit_zone(tile: FallingTile, hit_y: int, hit_window: int) -> bool:
    return tile.y <= (hit_y + hit_window) and (tile.y + tile.h) >= (hit_y - hit_window)


def lane_ready_for_tile(
    lane: int,
    tiles: list[FallingTile],
    play_top: int,
    tile_h: int,
    same_lane_gap_px: int,
) -> bool:
    same_lane_tiles = [t for t in tiles if (not t.hit) and t.lane == lane]
    if not same_lane_tiles:
        return True
    highest_existing_top = min(t.y for t in same_lane_tiles)
    return highest_existing_top >= play_top + tile_h + same_lane_gap_px

