#!/usr/bin/env python3
"""
Minimal TCP receiver for wavex-bridge JSONL (one UTF-8 JSON object per line).

Usage:
  python3 receive_jsonl_server.py 0.0.0.0 9100
  python3 receive_jsonl_server.py 100.75.108.87 9100   # bind only Tailscale IP
"""
from __future__ import annotations

import json
import socket
import sys


def main() -> None:
    host = "0.0.0.0"
    port = 9100
    if len(sys.argv) >= 2:
        host = sys.argv[1]
    if len(sys.argv) >= 3:
        port = int(sys.argv[2])

    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.bind((host, port))
    sock.listen(1)
    print(f"Listening on {host}:{port} (waiting for wavex-bridge)...", flush=True)

    conn, addr = sock.accept()
    print(f"Client connected from {addr}", flush=True)
    sock.close()

    try:
        with conn.makefile("rb") as rf:
            while True:
                chunk = rf.readline()
                if not chunk:
                    break
                line = chunk.decode("utf-8", errors="replace").strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                    # Print compact one-line confirmation; replace with your pipeline.
                    print(json.dumps(obj, separators=(",", ":"), ensure_ascii=False), flush=True)
                except json.JSONDecodeError as e:
                    print(f"# bad json: {e}: {line[:200]}", file=sys.stderr, flush=True)
    finally:
        conn.close()
        print("Connection closed.", flush=True)


if __name__ == "__main__":
    main()