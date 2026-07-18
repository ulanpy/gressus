from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd


CSV_PATH = Path("session_p5_20260625_combined.csv")

# Index of the detected cycle to display: 0 = first, 1 = second, etc.
CYCLE_NUMBER = 5

# Ignore implausibly close zero crossings.
MIN_CYCLE_INTERVAL_S = 0.5


def main() -> None:
    if not CSV_PATH.exists():
        raise FileNotFoundError(f"CSV file not found: {CSV_PATH}")

    df = pd.read_csv(CSV_PATH)

    required_columns = [
        "session_t_s",
        "step_idx",
        "HR_deg",
        "KR_deg",
        "HL_deg",
        "KL_deg",
    ]

    missing = [column for column in required_columns if column not in df.columns]
    if missing:
        raise ValueError(f"Missing required columns: {missing}")

    gait = df.copy()

    if "phase" in gait.columns:
        gait = gait[gait["phase"] == "GAIT"]

    if "running" in gait.columns:
        gait = gait[pd.to_numeric(gait["running"], errors="coerce") == 1]

    for column in required_columns:
        gait[column] = pd.to_numeric(gait[column], errors="coerce")

    gait = gait.dropna(subset=required_columns)
    gait = gait.sort_values("session_t_s").reset_index(drop=True)

    if gait.empty:
        raise ValueError("No valid gait data found.")

    print(
        "step_idx values:",
        sorted(gait["step_idx"].astype(int).unique()),
    )

    # Detect transitions into step_idx == 0.
    cycle_starts: list[float] = []
    previous_step: int | None = None
    last_start: float | None = None

    for _, row in gait.iterrows():
        current_step = int(row["step_idx"])
        current_time = float(row["session_t_s"])

        entered_zero = current_step == 0 and previous_step not in (None, 0)

        if entered_zero:
            if (
                last_start is None
                or current_time - last_start >= MIN_CYCLE_INTERVAL_S
            ):
                cycle_starts.append(current_time)
                last_start = current_time

        previous_step = current_step

    if len(cycle_starts) < 2:
        raise ValueError(
            "Not enough step_idx zero crossings were found to define a cycle."
        )

    cycle_count = len(cycle_starts) - 1
    print(f"Detected cycles: {cycle_count}")

    if CYCLE_NUMBER < 0 or CYCLE_NUMBER >= cycle_count:
        raise ValueError(
            f"CYCLE_NUMBER must be between 0 and {cycle_count - 1}."
        )

    start_s = cycle_starts[CYCLE_NUMBER]
    end_s = cycle_starts[CYCLE_NUMBER + 1]

    cycle = gait[
        (gait["session_t_s"] >= start_s)
        & (gait["session_t_s"] < end_s)
    ].copy()

    if len(cycle) < 5:
        raise ValueError("Selected cycle contains too few samples.")

    duration_s = end_s - start_s

    cycle["gait_pct"] = (
        (cycle["session_t_s"] - start_s)
        / duration_s
        * 100.0
    )

    print(
        f"Cycle {CYCLE_NUMBER}: "
        f"{start_s:.3f}–{end_s:.3f} s, "
        f"duration {duration_s:.3f} s, "
        f"{len(cycle)} samples"
    )

    # Hip angles.
    plt.figure(figsize=(12, 5))

    plt.plot(
        cycle["gait_pct"],
        cycle["HR_deg"],
        label="Right hip",
        linewidth=2,
    )
    plt.plot(
        cycle["gait_pct"],
        cycle["HL_deg"],
        label="Left hip",
        linewidth=2,
    )

    plt.title(f"Hip angles — estimated cycle {CYCLE_NUMBER}")
    plt.xlabel("Gait cycle (%)")
    plt.ylabel("Angle (deg)")
    plt.xlim(0, 100)
    plt.grid(True, alpha=0.3)
    plt.legend()
    plt.tight_layout()

    # Knee angles.
    plt.figure(figsize=(12, 5))

    plt.plot(
        cycle["gait_pct"],
        cycle["KR_deg"],
        label="Right knee",
        linewidth=2,
    )
    plt.plot(
        cycle["gait_pct"],
        cycle["KL_deg"],
        label="Left knee",
        linewidth=2,
    )

    plt.title(f"Knee angles — estimated cycle {CYCLE_NUMBER}")
    plt.xlabel("Gait cycle (%)")
    plt.ylabel("Angle (deg)")
    plt.xlim(0, 100)
    plt.grid(True, alpha=0.3)
    plt.legend()
    plt.tight_layout()

    plt.show()


if __name__ == "__main__":
    main()