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
| `estop` | `std_srvs/Trigger` | E-STOP (всегда) |
| `arm` | `std_srvs/Trigger` | ARM |
| `disarm` | `std_srvs/Trigger` | DISARM |
| `run` | `std_srvs/Trigger` | RUN gait |
| `stop_gait` | `std_srvs/Trigger` | STOP gait |
| `load_profile` | `gressus_msgs/LoadPgearProfile` | JSON профиля → устройство |

Пример:

```bash
ros2 service call /pgear_device_node/arm std_srvs/srv/Trigger
ros2 service call /pgear_device_node/run std_srvs/srv/Trigger

ros2 service call /pgear_device_node/load_profile gressus_msgs/srv/LoadPgearProfile \
  "{profile_json: '{\"mode\":\"position\",\"cps\":0.36,\"amp_r\":0.5,\"amp_l\":0.5,\"assist\":0.5,\"aan\":true,\"coeffs\":[],\"rom\":{},\"enable\":{}}'}"

ros2 topic echo /exoskeleton/telemetry --field connected,gait_phase,meas_torque
ros2 service call /pgear_device_node/estop std_srvs/srv/Trigger
```

`Trigger`: `success=false` + `failed (TCP link?)` — TCP ещё не открыт (нет UDP / неверный IP).

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
- Calibrate / characterize / `patient_torque` — **не реализованы** в этой ноде (следующий этап).

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
