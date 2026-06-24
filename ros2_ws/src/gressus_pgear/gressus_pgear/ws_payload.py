"""JSON payload for exoskeleton WebSocket clients."""

from __future__ import annotations

from gressus_msgs.msg import PgearTelemetry

_GAIT_PHASES = {
    0: "IDLE",
    1: "INIT",
    2: "GAIT",
    3: "HOMING",
}

_JOINTS = ("HR", "KR", "HL", "KL")


def msg_to_payload(msg: PgearTelemetry) -> dict:
    flags = int(msg.flags)
    return {
        "source": "live",
        "seq": int(msg.seq),
        "connected": bool(msg.connected),
        "error": msg.error or None,
        "gaitPhase": int(msg.gait_phase),
        "gaitPhaseName": _GAIT_PHASES.get(int(msg.gait_phase), "?"),
        "stepIdx": int(msg.step_idx),
        "profileSlot": int(msg.profile_slot),
        "version": int(msg.version),
        "sensorHealthMask": int(msg.sensor_health_mask),
        "flags": flags,
        "running": bool(flags & (1 << 0)),
        "estop": bool(flags & (1 << 1)),
        "sensorOnline": bool(flags & (1 << 2)),
        "aanOn": bool(flags & (1 << 4)),
        "linkAgeMs": int(msg.link_age_ms),
        "controllerTimeMs": int(msg.controller_time_ms),
        "ampR": float(msg.amp_r),
        "ampL": float(msg.amp_l),
        "assistR": float(msg.assist_r),
        "assistL": float(msg.assist_l),
        "ctrlLoopUs": int(msg.ctrl_loop_us),
        "linkCrcFails": int(msg.link_crc_fails),
        "linkResyncs": int(msg.link_resyncs),
        "crossCheckFault": int(msg.cross_check_fault),
        "hbErrorByte": int(msg.hb_error_byte),
        "hbAgeMs": [int(value) for value in msg.hb_age_ms],
        "joints": [
            {
                "name": _JOINTS[i],
                "refPos": float(msg.ref_pos[i]),
                "pos": float(msg.pos[i]),
                "vel": float(msg.vel[i]),
                "measTorque": float(msg.meas_torque[i]),
                "iq": float(msg.iq_measured[i]),
                "motorEffort": float(msg.motor_effort[i]),
            }
            for i in range(4)
        ],
    }


def disconnected_payload(*, error: str = "waiting for telemetry") -> dict:
    return {
        "source": "live",
        "seq": 0,
        "connected": False,
        "error": error,
        "gaitPhase": 0,
        "gaitPhaseName": "IDLE",
        "stepIdx": 0,
        "profileSlot": 0,
        "version": 0,
        "sensorHealthMask": 0,
        "flags": 0,
        "running": False,
        "estop": False,
        "sensorOnline": False,
        "aanOn": False,
        "linkAgeMs": 9999,
        "controllerTimeMs": 0,
        "ampR": 0.0,
        "ampL": 0.0,
        "assistR": 0.0,
        "assistL": 0.0,
        "ctrlLoopUs": 0,
        "linkCrcFails": 0,
        "linkResyncs": 0,
        "crossCheckFault": 0,
        "hbErrorByte": 0,
        "hbAgeMs": [0, 0, 0, 0],
        "joints": [
            {
                "name": name,
                "refPos": 0.0,
                "pos": 0.0,
                "vel": 0.0,
                "measTorque": 0.0,
                "iq": 0.0,
                "motorEffort": 0.0,
            }
            for name in _JOINTS
        ],
    }
