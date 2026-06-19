"""Wire-format constants for LogPacket_v2 UDP broadcasts."""

from __future__ import annotations

UDP_BROADCAST_PORT = 47_000
LOG_PACKET_SIZE = 206
CURRENT_PACKET_VERSION = 3

LOG_PACKET_MAGIC = (0xBB, 0x66)

PROFILE_SLOT_NONE = 0xFF
HEARTBEAT_NEVER_RECEIVED = 0xFFFF
