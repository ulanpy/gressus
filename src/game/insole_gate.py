from __future__ import annotations

from src.insole_stream import InsoleSnapshot


def insole_stats_for_lane(lane: int, snapshot: InsoleSnapshot, swap_lanes: bool):
    mapped_lane = 1 - lane if swap_lanes else lane
    return snapshot.left_stats if mapped_lane == 0 else snapshot.right_stats


def insole_allows_lane(
    lane: int,
    snapshot: InsoleSnapshot | None,
    max_age_s: float,
    *,
    swap_lanes: bool,
) -> bool:
    """Fail open while debugging; require pressure only when fresh insole data exists."""
    if snapshot is None or not snapshot.has_recent_data:
        return True
    if snapshot.age_s is not None and snapshot.age_s > max_age_s:
        return True
    stats = insole_stats_for_lane(lane, snapshot, swap_lanes)
    if not stats.has_data:
        return False
    return stats.pressed


def insole_hud_line(snapshot: InsoleSnapshot | None, threshold_kpa: float, max_age_s: float) -> str:
    if snapshot is None:
        return "insole: disabled"
    age_txt = "?" if snapshot.age_s is None else f"{snapshot.age_s:.2f}s"
    if snapshot.error:
        return f"insole: offline ({snapshot.error})  fail-open"
    if snapshot.age_s is None or snapshot.age_s > max_age_s:
        return f"insole: waiting/stale age={age_txt}  fail-open"
    left = "DOWN" if snapshot.left_stats.pressed else "up"
    right = "DOWN" if snapshot.right_stats.pressed else "up"
    return (
        f"insole: L {snapshot.left_stats.max_kpa:.0f}kPa {left} | "
        f"R {snapshot.right_stats.max_kpa:.0f}kPa {right} | "
        f"thr {threshold_kpa:.0f} age {age_txt}"
    )

