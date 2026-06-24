# gressus_pgear — ROS-нода P.GEAR (экзоскелет)

Пакет владеет **единственным command-клиентом** ESP32-S3: телеметрия по UDP, команды по TCP.
WebSocket-bridge (`pgear_pi.bridge`) **не используется** — только `Esp32Link` из submodule.

Спецификация протокола: `third_party/pgear_tools` + `pgear_v8_firmware/docs/API.md` (§7 — профиль пациента).

---

## Архитектура

```
ESP32-S3
   │  UDP :47000  телеметрия (LogPacket v3)
   │  TCP :47001  команды (CommandPacket)
   ▼
pgear_pi.transport.esp32_link   ← submodule third_party/pgear_tools
   ▼
Esp32Adapter                    ← потоки + thread-safe snapshot + profile JSON
   ▼
pgear_device_node               ← rclpy pub/services
   ▼
/exoskeleton/telemetry          ← gressus_msgs/PgearTelemetry
```

| Файл | Роль |
|------|------|
| `pgear_device_node.py` | ROS-нода: timer publish, services |
| `esp32_adapter.py` | Обёртка `Esp32Link`; callback UDP → lock → `_latest` |
| `profile_loader.py` | `load_profile` → opcodes на устройство (как bridge §7) |
| `telemetry_mapper.py` | `Telemetry` → `PgearTelemetry` |
| `ros_msg.py` | `empty_msg()` для disconnected/stale |

**Зачем adapter:** `Esp32Link` шлёт `on_telemetry` из фонового потока; rclpy не thread-safe.
Publish только из timer ноды, не из callback.

**PYTHONPATH:** `docker/ros-env.sh` (entrypoint + interactive shells).

---

## Зависимость submodule

```bash
git submodule update --init third_party/pgear_tools
```

`pgear_pi` **не** ament-пакет. Import path — `docker/ros-env.sh` → `PYTHONPATH=.../third_party/pgear_tools/pi_gui` (entrypoint и `exec ros2 bash`).

Если репо не в `/gressus`: `export GRESSUS_REPO_ROOT=/path/to/gressus`.

---

## Запуск

```bash
# только exo
ros2 launch gressus_bringup pgear.launch.py
ros2 launch gressus_bringup pgear.launch.py esp_host:=192.168.1.50

# клинический стек (insole + camera + exo), без игры
ros2 launch gressus_bringup feedback.launch.py esp_host:=192.168.1.50

# через backend / session_manager
POST /api/runtime/start  {"job":"feedback","espHost":"192.168.1.50", ...}
```

`esp_host` пустой → IP ESP32 из **первого UDP-пакета** (auto-discover).

---

## Параметры ноды

| Параметр | Default | Описание |
|----------|---------|----------|
| `esp_host` | `""` | IP ESP32; пусто = auto |
| `publish_hz` | `100` | частота publish |
| `stale_after_s` | `0.5` | таймаут «живой» телеметрии |
| `topic` | `/exoskeleton/telemetry` | |
| `frame_id` | `exoskeleton` | |
| `serve_ws` | `true` | Enable WebSocket fanout |
| `ws_port` | `8766` | WebSocket port |
| `ws_path` | `/ws/exoskeleton` | WebSocket path |
| `ws_hz` | `20` | WebSocket publish rate |

---

## WebSocket (live UI)

**`ws://0.0.0.0:8766/ws/exoskeleton`** — JSON frames @ ~20 Hz (same fields as telemetry topic, camelCase).

Vite dev proxy: `/ws/exoskeleton` → `:8766`.

---

## Топик

**`/exoskeleton/telemetry`** — `gressus_msgs/PgearTelemetry`

- `connected=false` + `error` — нет UDP, stale, или ждём первый пакет
- Поля: `pos`, `vel`, `meas_torque`, `gait_phase`, `flags`, `cmd_torque`, …
- **Пока нет:** `patient_torque` / `patient_status` (нужен calibrator из bridge)

---

## Services

Все под namespace ноды: `/pgear_device_node/...`

| Service | Тип | Действие |
|---------|-----|----------|
| `estop` | `std_srvs/Trigger` | E-STOP |
| `estop_reset` | `std_srvs/Trigger` | CLEAR ERR (после E-STOP) |
| `arm` | `std_srvs/Trigger` | ARM |
| `disarm` | `std_srvs/Trigger` | DISARM |
| `full_cal` | `std_srvs/Trigger` | ODrive FULL CAL (**только DISARM**) |
| `run` | `std_srvs/Trigger` | RUN gait |
| `stop_gait` | `std_srvs/Trigger` | STOP gait |
| `load_profile` | `gressus_msgs/LoadPgearProfile` | JSON → устройство |
| `calibrate_baseline` | `gressus_msgs/CalibratePgearBaseline` | ~30 s fit пустого exo (**ARM+RUN**) |

Пример:

```bash
ros2 service call /pgear_device_node/arm std_srvs/srv/Trigger
ros2 service call /pgear_device_node/run std_srvs/srv/Trigger

ros2 service call /pgear_device_node/load_profile gressus_msgs/srv/LoadPgearProfile \
  "{profile_json: '{\"mode\":\"position\",\"cps\":0.36,\"amp_r\":0.5,\"amp_l\":0.5,\"assist\":0.5,\"aan\":true,\"coeffs\":[],\"rom\":{},\"enable\":{}}'}"

ros2 topic echo /exoskeleton/telemetry --field connected
ros2 topic echo /exoskeleton/telemetry --field gait_phase
# or full message:
ros2 topic echo /exoskeleton/telemetry --once
ros2 service call /pgear_device_node/estop std_srvs/srv/Trigger
```

`Trigger`: `success=false` + `failed (TCP link?)` — TCP ещё не открыт (нет UDP / неверный IP).

### Инженерный SOP (всё через ROS, без bridge/GUI)

```bash
# 0. launch
ros2 launch gressus_bringup pgear.launch.py

# 1. почистка
ros2 service call /pgear_device_node/stop_gait std_srvs/srv/Trigger "{}"
ros2 service call /pgear_device_node/disarm std_srvs/srv/Trigger "{}"
ros2 service call /pgear_device_node/estop_reset std_srvs/srv/Trigger "{}"   # если был E-STOP

# 2. FULL CAL (разово, DISARM, моторы крутятся)
ros2 service call /pgear_device_node/full_cal std_srvs/srv/Trigger "{}"

# 3. load_profile — enable + ROM (+ coeffs после calibrate_baseline)
ros2 service call /pgear_device_node/load_profile gressus_msgs/srv/LoadPgearProfile \
  "{profile_json: '{\"mode\":\"position\",\"cps\":0.36,\"amp_r\":0.5,\"amp_l\":0.5,\"assist\":0.5,\"aan\":false,\"coeffs\":[],\"rom\":{\"0\":[-18,25],\"1\":[-6,31],\"2\":[-18,25],\"3\":[-6,31]},\"enable\":{\"0\":true,\"1\":true,\"2\":true,\"3\":true}}'}"

# 4. baseline-калибровка пустого exo (~33 s блокирует терминал)
ros2 service call /pgear_device_node/arm std_srvs/srv/Trigger "{}"
ros2 service call /pgear_device_node/run std_srvs/srv/Trigger "{}"
ros2 service call /pgear_device_node/calibrate_baseline gressus_msgs/srv/CalibratePgearBaseline "{duration_s: 0}"

# 5. рабочий цикл
ros2 service call /pgear_device_node/stop_gait std_srvs/srv/Trigger "{}"
ros2 service call /pgear_device_node/arm std_srvs/srv/Trigger "{}"
ros2 service call /pgear_device_node/run std_srvs/srv/Trigger "{}"
```

JSON baselines сохраняются в `third_party/pgear_tools/pi_gui/pgear_pi/calibration/baseline_*.json`.

### Порядок типичной сессии

1. Launch (auto-discover или `esp_host`)
2. `load_profile` — JSON exo-профиля (из backend/Postgres, когда будет интеграция)
3. `arm` → `run`
4. … feedback / логирование …
5. `stop_gait` → `disarm` (или `estop`)

---

## Профиль exo (`load_profile`)

Exo-профиль — настройки контроллера под ребёнка (mode, cps, coeffs, rom, …).
Формат — bridge / API.md §7:

```json
{
  "mode": "position",
  "cps": 0.36,
  "amp_r": 0.5,
  "amp_l": 0.5,
  "assist": 0.5,
  "aan": true,
  "coeffs": [[0, 0, [a,b,c,d,e]], ...],
  "rom": {"0": [-18, 25]},
  "enable": {"0": true}
}
```

Допустима обёртка `{"profile": { ... }}`.

**Сейчас:** только явный вызов service `~/load_profile`.
**План:** backend читает профиль из Postgres и вызывает service при старте сессии.

---

## Связь с clinical session

`session_manager` прокидывает в launch env:

- `GRESSUS_SESSION_ID`
- `GRESSUS_PATIENT_ID`
- `GRESSUS_SESSION_DATA_DIR`

Профиль exo через env/файлы **не загружается** — только через `load_profile` (пока вручную или из backend позже).

---

## Ограничения

- **Один TCP-клиент** на ESP32. Не запускать одновременно GUI коллеги с прямым `esp32_link` и эту ноду.
- Submodule bump — осознанно, после изменений протокола в `pgear_tools`.
- Calibrate / characterize patient — **baseline** через `calibrate_baseline`; patient passive sweep — следующий этап

---

## Troubleshooting

| Симптом | Проверить |
|---------|-----------|
| `No module named 'pgear_pi'` | submodule init; `echo $PYTHONPATH`; пересобрать colcon |
| `waiting for UDP telemetry` | ESP32 включён, та же сеть, firewall UDP 47000 |
| `failed (TCP link?)` | дождаться UDP; задать `esp_host:=` явно |
| `stale telemetry` | пропали UDP-пакеты; проверить WiFi / прошивку |
| `ModuleNotFoundError` в Docker | `git submodule update --init` на хосте перед build |

---

## Сборка

```bash
cd ros2_ws && colcon build --packages-select gressus_msgs gressus_pgear
source install/setup.bash
ros2 run gressus_pgear pgear_device_node
```
