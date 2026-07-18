from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd


CSV_PATH = Path("session_p5_20260625_combined.csv")


def main() -> None:
    if not CSV_PATH.exists():
        raise FileNotFoundError(f"CSV file not found: {CSV_PATH}")

    df = pd.read_csv(CSV_PATH)

    required_columns = [
        "session_t_s",
        "HR_deg",
        "KR_deg",
        "HL_deg",
        "KL_deg",
    ]

    missing = [column for column in required_columns if column not in df.columns]
    if missing:
        raise ValueError(f"Missing required columns: {missing}")

    print(
        df[
            [
                "HR_deg",
                "KR_deg",
                "HL_deg",
                "KL_deg",
            ]
        ].describe()
    )

    # Keep only valid gait data.
    gait = df.copy()

    if "phase" in gait.columns:
        gait = gait[gait["phase"] == "GAIT"]

    if "running" in gait.columns:
        gait = gait[pd.to_numeric(gait["running"], errors="coerce") == 1]

    for column in required_columns:
        gait[column] = pd.to_numeric(gait[column], errors="coerce")

    gait = gait.dropna(subset=required_columns)
    gait = gait.sort_values("session_t_s")

    if gait.empty:
        raise ValueError("No valid GAIT/running rows were found.")

    # Select time window.
    start_s = 100
    end_s = 500

    window = gait[
        (gait["session_t_s"] >= start_s)
        & (gait["session_t_s"] <= end_s)
    ].copy()

    if window.empty:
        raise ValueError(
            f"No data found between {start_s} and {end_s} seconds."
        )

    # Downsample for plotting.
    window = window.iloc[::5]

    # Hip graph.
    plt.figure(figsize=(14, 5))

    plt.plot(
        window["session_t_s"],
        window["HR_deg"],
        label="Right Hip",
        linewidth=1,
    )

    plt.plot(
        window["session_t_s"],
        window["HL_deg"],
        label="Left Hip",
        linewidth=1,
    )

    plt.title("Hip Joint Angles")
    plt.xlabel("Session time (s)")
    plt.ylabel("Angle (deg)")
    plt.grid(True, alpha=0.3)
    plt.legend()
    plt.tight_layout()

    # Knee graph.
    plt.figure(figsize=(14, 5))

    plt.plot(
        window["session_t_s"],
        window["KR_deg"],
        label="Right Knee",
        linewidth=1,
    )

    plt.plot(
        window["session_t_s"],
        window["KL_deg"],
        label="Left Knee",
        linewidth=1,
    )

    plt.title("Knee Joint Angles")
    plt.xlabel("Session time (s)")
    plt.ylabel("Angle (deg)")
    plt.grid(True, alpha=0.3)
    plt.legend()
    plt.tight_layout()

    plt.show()


if __name__ == "__main__":
    main()