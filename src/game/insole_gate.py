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
    dominance_kpa: float = 15.0,
) -> bool:
    """Lane's foot must (a) be above threshold and (b) dominate the other foot.

    Both feet usually rest on the treadmill, so an absolute threshold alone
    fires on the supporting foot too. Requiring dominance over the other side
    identifies the actively-stepping foot.

    Fail-open semantics: returns True when there is no fresh insole data at
    all, so depth/RGB gates remain the source of truth while debugging.
    """
    if snapshot is None or not snapshot.has_recent_data:
        return True
    if snapshot.age_s is not None and snapshot.age_s > max_age_s:
        return True
    own = insole_stats_for_lane(lane, snapshot, swap_lanes)
    other = insole_stats_for_lane(1 - lane, snapshot, swap_lanes)
    if not own.has_data:
        return False
    if not other.has_data:
        return own.pressed
    if not own.pressed:
        return False
    return (own.max_kpa - other.max_kpa) >= dominance_kpa


def insole_hud_line(
    snapshot: InsoleSnapshot | None,
    threshold_kpa: float,
    max_age_s: float,
    *,
    dominance_kpa: float = 15.0,
    swap_lanes: bool = False,
) -> str:
    if snapshot is None:
        return "insole: disabled"
    age_txt = "?" if snapshot.age_s is None else f"{snapshot.age_s:.2f}s"
    if snapshot.error:
        return f"insole: offline ({snapshot.error})  fail-open"
    if snapshot.age_s is None or snapshot.age_s > max_age_s:
        return f"insole: waiting/stale age={age_txt}  fail-open"
    l_stats = insole_stats_for_lane(0, snapshot, swap_lanes)
    r_stats = insole_stats_for_lane(1, snapshot, swap_lanes)
    diff = l_stats.max_kpa - r_stats.max_kpa
    if diff >= dominance_kpa:
        dom = "L>R"
    elif -diff >= dominance_kpa:
        dom = "R>L"
    else:
        dom = "tie"
    left = "DOWN" if l_stats.pressed else "up"
    right = "DOWN" if r_stats.pressed else "up"
    return (
        f"insole: L {l_stats.max_kpa:.0f}kPa {left} | "
        f"R {r_stats.max_kpa:.0f}kPa {right} | "
        f"thr {threshold_kpa:.0f}  dom {dominance_kpa:.0f} → {dom}({diff:+.0f})  age {age_txt}"
    )

