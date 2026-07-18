#!/usr/bin/env python3
"""Combine split Gressus session CSV logs into one session timeline."""

from __future__ import annotations

import argparse
import csv
from datetime import datetime
from pathlib import Path
import re

TIMESTAMP_RE = re.compile(r"_(\d{8})_(\d{6})$")


def _file_start(path: Path) -> datetime:
    match = TIMESTAMP_RE.search(path.stem)
    if not match:
        raise ValueError(f"cannot infer start timestamp from filename: {path}")
    return datetime.strptime("".join(match.groups()), "%Y%m%d%H%M%S")


def _read_rows(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    with path.open("r", encoding="utf-8", newline="") as file:
        reader = csv.DictReader(file)
        if not reader.fieldnames:
            raise ValueError(f"CSV has no header: {path}")
        return list(reader.fieldnames), list(reader)


def _float(row: dict[str, str], key: str) -> float:
    return float(row[key])


def combine(csv_paths: list[Path], output_path: Path) -> None:
    inputs = sorted(csv_paths, key=_file_start)
    first_start = _file_start(inputs[0])

    original_fields: list[str] | None = None
    previous_segment_end_s: float | None = None

    extra_fields = [
        "session_t_s",
        "source_file",
        "source_segment_idx",
        "segment_start_offset_s",
        "inter_segment_gap_s",
    ]
    rows: list[dict[str, str]] = []

    for segment_idx, path in enumerate(inputs):
        fields, segment_rows = _read_rows(path)
        if original_fields is None:
            original_fields = fields
        elif fields != original_fields:
            raise ValueError(f"CSV header mismatch: {path}")

        segment_start_offset_s = (_file_start(path) - first_start).total_seconds()
        first_row_t_s = _float(segment_rows[0], "t_s") if segment_rows else 0.0
        segment_first_session_t_s = segment_start_offset_s + first_row_t_s
        inter_segment_gap_s = (
            0.0
            if previous_segment_end_s is None
            else segment_first_session_t_s - previous_segment_end_s
        )

        for row in segment_rows:
            session_t_s = segment_start_offset_s + _float(row, "t_s")
            out = {
                "session_t_s": f"{session_t_s:.4f}",
                "source_file": path.name,
                "source_segment_idx": str(segment_idx),
                "segment_start_offset_s": f"{segment_start_offset_s:.4f}",
                "inter_segment_gap_s": f"{inter_segment_gap_s:.4f}",
            }
            out.update(row)
            rows.append(out)

        if segment_rows:
            previous_segment_end_s = segment_start_offset_s + _float(segment_rows[-1], "t_s")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=extra_fields + (original_fields or []))
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("csv", nargs="+", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    combine(args.csv, args.output)
    print(args.output)


if __name__ == "__main__":
    main()
