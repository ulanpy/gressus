#!/usr/bin/env python3
"""Convert Gressus P.GEAR CSV telemetry logs to simple JSON MCAP bags."""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
import struct
from typing import Any

MCAP_MAGIC = b"\x89MCAP0\r\n"

OP_HEADER = 0x01
OP_FOOTER = 0x02
OP_SCHEMA = 0x03
OP_CHANNEL = 0x04
OP_MESSAGE = 0x05
OP_DATA_END = 0x0F


def _u16(value: int) -> bytes:
    return struct.pack("<H", value)


def _u32(value: int) -> bytes:
    return struct.pack("<I", value)


def _u64(value: int) -> bytes:
    return struct.pack("<Q", value)


def _string(value: str) -> bytes:
    data = value.encode("utf-8")
    return _u32(len(data)) + data


def _map(values: dict[str, str]) -> bytes:
    out = bytearray(_u32(len(values)))
    for key, value in values.items():
        out += _string(key)
        out += _string(value)
    return bytes(out)


def _record(opcode: int, payload: bytes) -> bytes:
    return bytes([opcode]) + _u64(len(payload)) + payload


def _coerce(value: str) -> Any:
    text = value.strip()
    if not text:
        return None
    try:
        integer = int(text)
    except ValueError:
        pass
    else:
        return integer
    try:
        return float(text)
    except ValueError:
        return text


def _row_time_ns(row: dict[str, Any], fallback_index: int) -> int:
    value = row.get("session_t_s", row.get("t_s"))
    if isinstance(value, (int, float)):
        return max(0, int(float(value) * 1_000_000_000))
    return fallback_index * 10_000_000


def _row_seq(row: dict[str, Any], fallback_index: int) -> int:
    value = row.get("seq")
    if isinstance(value, int):
        return max(0, value)
    if isinstance(value, float):
        return max(0, int(value))
    return fallback_index


def _schema(columns: list[str]) -> bytes:
    properties: dict[str, dict[str, Any]] = {}
    for column in columns:
        properties[column] = {
            "type": ["number", "integer", "string", "null"],
        }
    return json.dumps(
        {
            "$schema": "https://json-schema.org/draft/2020-12/schema",
            "title": "Gressus P.GEAR CSV telemetry row",
            "type": "object",
            "properties": properties,
            "additionalProperties": False,
        },
        separators=(",", ":"),
    ).encode("utf-8")


def _write_metadata_yaml(
    path: Path,
    *,
    mcap_name: str,
    source_csv: Path,
    message_count: int,
    start_ns: int,
    end_ns: int,
) -> None:
    duration = max(0, end_ns - start_ns)
    path.write_text(
        "\n".join(
            [
                "rosbag2_bagfile_information:",
                "  version: 9",
                "  storage_identifier: mcap",
                f"  duration: {duration}",
                f"  starting_time: {start_ns}",
                f"  message_count: {message_count}",
                "  relative_file_paths:",
                f"    - {mcap_name}",
                "  topics_with_message_count:",
                "    - topic_metadata:",
                "        name: /gressus/pgear/telemetry_csv",
                "        type: gressus_msgs/msg/PgearTelemetryCsvRow",
                "        serialization_format: json",
                "      message_count: " + str(message_count),
                f"  source_csv: {source_csv}",
            ]
        )
        + "\n",
        encoding="utf-8",
    )


def convert_csv_to_mcap(csv_path: Path, output_dir: Path) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    mcap_path = output_dir / f"{csv_path.stem}.mcap"

    with csv_path.open("r", encoding="utf-8", newline="") as csv_file:
        reader = csv.DictReader(csv_file)
        if not reader.fieldnames:
            raise ValueError(f"CSV has no header: {csv_path}")

        columns = list(reader.fieldnames)
        first_time_ns: int | None = None
        last_time_ns = 0
        message_count = 0

        with mcap_path.open("wb") as mcap:
            mcap.write(MCAP_MAGIC)
            mcap.write(_record(OP_HEADER, _string("gressus.csv") + _string("gressus csv_to_mcap")))
            mcap.write(
                _record(
                    OP_SCHEMA,
                    _u16(1)
                    + _string("gressus_msgs/msg/PgearTelemetryCsvRow")
                    + _string("jsonschema")
                    + _u32(len(_schema(columns)))
                    + _schema(columns),
                )
            )
            mcap.write(
                _record(
                    OP_CHANNEL,
                    _u16(1)
                    + _u16(1)
                    + _string("/gressus/pgear/telemetry_csv")
                    + _string("json")
                    + _map({"source": str(csv_path)}),
                )
            )

            for index, raw_row in enumerate(reader, start=1):
                row = {key: _coerce(value) for key, value in raw_row.items()}
                time_ns = _row_time_ns(row, index)
                if first_time_ns is None:
                    first_time_ns = time_ns
                last_time_ns = time_ns
                message_count += 1

                data = json.dumps(row, separators=(",", ":")).encode("utf-8")
                mcap.write(
                    _record(
                        OP_MESSAGE,
                        _u16(1)
                        + _u32(_row_seq(row, index))
                        + _u64(time_ns)
                        + _u64(time_ns)
                        + data,
                    )
                )

            mcap.write(_record(OP_DATA_END, _u32(0)))
            mcap.write(_record(OP_FOOTER, _u64(0) + _u64(0) + _u32(0)))
            mcap.write(MCAP_MAGIC)

    _write_metadata_yaml(
        output_dir / "metadata.yaml",
        mcap_name=mcap_path.name,
        source_csv=csv_path,
        message_count=message_count,
        start_ns=first_time_ns or 0,
        end_ns=last_time_ns,
    )
    return mcap_path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("csv", nargs="+", type=Path)
    parser.add_argument("--out-root", type=Path, default=Path("backend/converted_mcap"))
    args = parser.parse_args()

    for csv_path in args.csv:
        output_dir = args.out_root / csv_path.stem / "rosbag"
        mcap_path = convert_csv_to_mcap(csv_path, output_dir)
        print(mcap_path)


if __name__ == "__main__":
    main()
