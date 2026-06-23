"""Helpers for gressus_msgs/PgearTelemetry."""

from gressus_msgs.msg import PgearTelemetry


def empty_msg(stamp, *, connected: bool, error: str, frame_id: str = "exoskeleton") -> PgearTelemetry:
    msg = PgearTelemetry()
    msg.header.stamp = stamp
    msg.header.frame_id = frame_id
    msg.connected = connected
    msg.error = error
    return msg
