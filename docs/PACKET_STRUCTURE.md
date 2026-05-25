# LogPacket_v2 — UDP Broadcast Packet Structure

Broadcast to `255.255.255.255:47000` at **100 Hz**.
Little-endian, `__attribute__((packed))`, **206 bytes total**.
Defined in `pgear_v7_addons.h`. Wire format version: **3** (current); 2 in older builds.

Magic / sync: `0xBB 0x66` at bytes 0–1. Verify `version == 3` before parsing.

---

## HEADER — 8 bytes

| Offset | Type     | Field       | Notes                                              |
|--------|----------|-------------|----------------------------------------------------|
| 0      | `uint8`  | `start0`    | `0xBB`                                             |
| 1      | `uint8`  | `start1`    | `0x66`                                             |
| 2      | `uint8`  | `version`   | `3` current; `2` in older builds                  |
| 3      | `uint8`  | `reserved0` | `0`                                                |
| 4      | `uint16` | `seq`       | Packet sequence number                             |
| 6      | `uint16` | `headerCrc` | CRC-16 of bytes [0..5] for fast version detection |

---

## TIMING — 4 bytes

| Offset | Type     | Field    | Notes                    |
|--------|----------|----------|--------------------------|
| 8      | `uint32` | `timeMs` | `millis()` at packet build |

---

## GAIT / TOP-LEVEL STATE — 8 bytes

| Offset | Type     | Field          | Notes                                                      |
|--------|----------|----------------|------------------------------------------------------------|
| 12     | `uint8`  | `gaitPhase`    | `PH_IDLE=0 … PH_GAIT … PH_RAMP_DOWN`                      |
| 13     | `uint8`  | `stepIdx`      | 0–49 within 50-point trajectory                           |
| 14     | `uint8`  | `profileSlot`  | Active NVS slot (0–7); `0xFF` = none                      |
| 15     | `uint8`  | `sensorHealth` | Bitmask: bit0=R-hip, bit1=R-knee, bit2=L-hip, bit3=L-knee |
| 16     | `uint16` | `flags`        | See flag bits below                                        |
| 18     | `uint16` | `linkAgeMs`    | ms since last good sensor UART packet (clamped to 0xFFFF) |

### `flags` bit map

| Bit  | Meaning                                          |
|------|--------------------------------------------------|
| 0    | `runFlag`                                        |
| 1    | `emergencyStop`                                  |
| 2    | `sensorLink.online`                              |
| 3    | `ffEnabled`                                      |
| 4    | `fuzzyEnabled`                                   |
| 5    | `ffpTripped` — FF passivity monitor tripped      |
| 6    | `segmentGravModel`                               |
| 7    | `anyCrossCheckFault`                             |
| 8    | `gaitAutoProgress`                               |
| 9    | `torqueMode` — 1 = torque control, 0 = position  |
| 10–15 | reserved                                        |

---

## JOINT ARRAYS — 136 bytes

Joint order: **0 = R-hip, 1 = R-knee, 2 = L-hip, 3 = L-knee**

| Offset | Type        | Field         | Unit | Notes                                            |
|--------|-------------|---------------|------|--------------------------------------------------|
| 20     | `float[4]`  | `refPos`      | turns | Reference trajectory position                  |
| 36     | `float[4]`  | `pos`         | turns | Actual encoder position                        |
| 52     | `float[4]`  | `vel`         | turns/s | Actual velocity                             |
| 68     | `float[4]`  | `cmdTorque`   | Nm   | Commanded torque (post-rate-limit, post-clamp); 0 in position mode |
| 84     | `float[4]`  | `measTorque`  | Nm   | Measured torque from LCM300 load cell          |
| 100    | `float[4]`  | `gravTerm`    | Nm   | Gravity compensation contribution this cycle   |
| 116    | `float[4]`  | `ffTerm`      | Nm   | Feedforward contribution this cycle            |
| 132    | `float[4]`  | `iqMeasured`  | A    | Motor q-axis current (cross-check input)       |
| 148    | `float[4]`  | `motorEffort` | Nm   | Iq-derived torque estimate (Iq × Kt × N × η, signed by motor direction) |
| 164    | `uint16[4]` | `hbAgeMs`     | ms   | Age of last ODrive heartbeat per axis; `0xFFFF` = never received |

---

## THERAPIST TUNABLES — 24 bytes

| Offset | Type    | Field        | Notes                       |
|--------|---------|--------------|-----------------------------|
| 172    | `float` | `assistR`    | Right-leg assist level      |
| 176    | `float` | `assistL`    | Left-leg assist level       |
| 180    | `float` | `deadzoneR`  | Right dead-zone (turns)     |
| 184    | `float` | `deadzoneL`  | Left dead-zone (turns)      |
| 188    | `float` | `ampR`       | Right trajectory amplitude  |
| 192    | `float` | `ampL`       | Left trajectory amplitude   |

---

## DIAGNOSTICS — 8 bytes

| Offset | Type     | Field            | Notes                                             |
|--------|----------|------------------|---------------------------------------------------|
| 196    | `uint16` | `ctrlLoopUs`     | Last 250 Hz control loop execution time (µs)      |
| 198    | `uint16` | `linkCrcFails`   | Sensor-UART CRC failures since boot               |
| 200    | `uint16` | `linkResyncs`    | Sensor-UART resyncs since boot                    |
| 202    | `uint8`  | `crossCheckFault`| Bitmask: bit i = joint i has latched cross-check fault |
| 203    | `uint8`  | `hbErrorByte`    | Bitmask: bit i = joint i `lastHbError != 0`       |

---

## TRAILER — 2 bytes

| Offset | Type     | Field | Notes                                  |
|--------|----------|-------|----------------------------------------|
| 204    | `uint16` | `crc` | CRC-16/CCITT over bytes [0..203]       |

---

## Python receive example

```python
import socket, struct

UDP_PORT = 47000
MAGIC = (0xBB, 0x66)

sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
sock.bind(("", UDP_PORT))

while True:
    data, addr = sock.recvfrom(512)
    if len(data) < 206 or data[0] != 0xBB or data[1] != 0x66:
        continue
    version = data[2]
    if version != 3:
        print(f"unexpected version {version}")
        continue

    # Header
    start0, start1, version, reserved0, seq, headerCrc = struct.unpack_from("<BBBBhH", data, 0)
    # Timing
    timeMs, = struct.unpack_from("<I", data, 8)
    # Gait state
    gaitPhase, stepIdx, profileSlot, sensorHealth, flags, linkAgeMs = struct.unpack_from("<BBBBHh", data, 12)
    # Joint arrays (order: R-hip=0, R-knee=1, L-hip=2, L-knee=3)
    refPos      = struct.unpack_from("<4f", data, 20)
    pos         = struct.unpack_from("<4f", data, 36)
    vel         = struct.unpack_from("<4f", data, 52)
    cmdTorque   = struct.unpack_from("<4f", data, 68)
    measTorque  = struct.unpack_from("<4f", data, 84)
    gravTerm    = struct.unpack_from("<4f", data, 100)
    ffTerm      = struct.unpack_from("<4f", data, 116)
    iqMeasured  = struct.unpack_from("<4f", data, 132)
    motorEffort = struct.unpack_from("<4f", data, 148)
    hbAgeMs     = struct.unpack_from("<4H", data, 164)
    # Tunables
    assistR, assistL, deadzoneR, deadzoneL, ampR, ampL = struct.unpack_from("<6f", data, 172)
    # Diagnostics
    ctrlLoopUs, linkCrcFails, linkResyncs, crossCheckFault, hbErrorByte = struct.unpack_from("<HHHBb", data, 196)
    # Trailer CRC
    crc, = struct.unpack_from("<H", data, 204)

    print(f"t={timeMs} ms | phase={gaitPhase} step={stepIdx} | "
          f"R-hip pos={pos[0]:.2f} trn  torque={measTorque[0]:.2f} Nm")
```

For a full-featured logger with CSV export and live plotting see `docs/pgear_udp_logger.py`.
