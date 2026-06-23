"""Apply patient profile JSON to Esp32Link (subset of pgear_pi.bridge load_profile)."""

from typing import Any, Protocol


class PgearCommandLink(Protocol):
    def set_mode(self, mode: int) -> bool: ...

    def set_cps(self, value: float) -> bool: ...

    def set_amp_r(self, value: float) -> bool: ...

    def set_amp_l(self, value: float) -> bool: ...

    def set_assist(self, value: float) -> bool: ...

    def set_aan(self, on: bool) -> bool: ...

    def set_rom(self, joint: int, lo: float, hi: float) -> bool: ...

    def set_enable(self, joint: int, enabled: bool) -> bool: ...

    def load_coeffs(
        self,
        joint: int,
        kind: int,
        coef5: list[float],
        resid_std: float = 0.0,
        cal_cps: float = 0.0,
        cal_amp: float = 0.0,
    ) -> bool: ...


def apply_profile(link: PgearCommandLink, profile: dict[str, Any]) -> None:
    """Push profile fields to the device (bridge/API.md §7 shape)."""
    from pgear_pi.transport.esp32_link import MODE_POSITION, MODE_TORQUE

    if "mode" in profile:
        mode = profile["mode"]
        torque = str(mode).lower() in {"1", "torque", "true"}
        link.set_mode(MODE_TORQUE if torque else MODE_POSITION)

    for item in profile.get("coeffs", []):
        joint, kind, coef = int(item[0]), int(item[1]), [float(x) for x in list(item[2])]
        link.load_coeffs(joint, kind, coef)

    for joint_key, bounds in profile.get("rom", {}).items():
        lo, hi = float(bounds[0]), float(bounds[1])
        link.set_rom(int(joint_key), lo, hi)

    for joint_key, enabled in profile.get("enable", {}).items():
        link.set_enable(int(joint_key), bool(enabled))

    if "cps" in profile:
        link.set_cps(float(profile["cps"]))
    if "amp_r" in profile:
        link.set_amp_r(float(profile["amp_r"]))
    if "amp_l" in profile:
        link.set_amp_l(float(profile["amp_l"]))
    if "assist" in profile:
        link.set_assist(float(profile["assist"]))
    if "aan" in profile:
        link.set_aan(bool(profile["aan"]))
