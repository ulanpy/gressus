# Raw EMG: текущий рабочий контракт

Дата последней live-проверки: 2026-09-11.

## Что включено

- WaveX slots `1..16` — физические EMG sensors.
- WaveX slots `17,18` — InsoleX; в raw EMG поток не передаются.
- IMU намеренно выключен: bridge не запрашивает и не публикует IMU samples.
- Windows Scheduled Task `Gressus Cometa Bridge Watchdog` запускает bridge с
  `--emg-tcp 192.168.122.1 9101 --emg-sensors 1,2,...,16`.

Названия мышц и сторона задаются в EMG & Motion Tools для operator UI. Bridge
не меняет эту vendor configuration и не передаёт names в ROS: источник истины
в rosbag — `sensor_slots`. Перед клиническим использованием необходимо
сохранить отдельную таблицу `slot -> muscle -> side` рядом с данными сеанса.

## EMG & Motion Tools configuration

In the **Sensors** tab, `Emg Sensor Data Protocol` is the hardware acquisition
setting; current configuration is `Emg 2kHz`. In the **EMG** tab, `Name` and
`Side` only assign human-readable muscle metadata to slots.

The **System -> Data Publishing -> Period** value belongs to EMG & Motion
Tools' own publishing/UI path. Do **not** set it to 50 ms for this bridge:
`wavex-bridge` independently requests its SDK delivery period when calling
`StartCapturing`. Pressing **Confirm** applies the full vendor
`CaptureConfiguration`, including `EMG_AcqXType`, not only muscle labels.
After any Confirm, close EMG & Motion Tools and restart the Windows bridge so
it reads the newly saved configuration.

## Поток и формат

```text
16 WaveX EMG sensors (2 kHz)
  -> receiver/Windows SDK batches of 50 ms
  -> wavex-bridge binary TCP :9101
  -> emg_bridge_node
  -> ROS 2 /emg/raw
  -> ros2 bag record -a during a clinical session
```

Bridge запрашивает WaveX `DataAvailableEventPeriod.ms_50`. Он не усредняет,
не decimate и не конвертирует EMG в JSON: `samples_per_channel` в каждом
сообщении — точное число raw values, фактически доставленных SDK в этом
кадре. Не выводите hardware sample rate из этого размера или из ROS callback
period: SDK может выбрать иной размер delivery batch.

`/emg/raw` имеет тип `gressus_msgs/EmgFrame`:

| Поле | Значение |
| --- | --- |
| `frame_seq` | Монотонный номер bridge-кадра; сбрасывается после restart bridge. Использовать для поиска пропусков. |
| `sample_rate_hz` | Hardware rate из saved WaveX `EMG_AcqXType`. Для current `Emg 2kHz`: `2000`. |
| `samples_per_channel` | Точный фактический размер SDK batch; не фиксированный контракт. |
| `sensor_slots` | `[1, ..., 16]`, порядок каналов. |
| `samples` | `float32`, channel-major: первые `samples_per_channel` — slot 1, затем slot 2 и т.д. Всего `16 * samples_per_channel` values/кадр. |
| `header.stamp` | Linux ROS receipt time, **не** аппаратная временная шкала WaveX. |

`ros2 topic echo /emg/raw --once` печатает один кадр и сокращает большой
массив через `...`; это не означает, что получен один sample.

## Штатный запуск

ROS container автоматически стартует `gressus_session/runtime.launch.py`,
который включает `insole.launch.py`. Там постоянно подняты listeners:

- `insole_bridge_node`: TCP `:9100` -> `/insole/pressure` и WebSocket `:8765`;
- `emg_bridge_node`: TCP `:9101` -> `/emg/raw`.

Новый listener начинает реально принимать EMG только после restart ROS
container, который выполняет `colcon build --symlink-install`. Windows bridge
начинает слать EMG только после регистрации Task с непустым `-EmgSensors`.

Обычный clinical start в Gressus создаёт session и запускает `ros2 bag record
-a`; `/emg/raw` записывается только в активный rosbag. Вне session data могут
быть видны через ROS, но отдельный EMG file не создаётся.

## Проверка

```bash
docker compose exec ros2 bash -lc \
  'source /gressus/docker/ros-env.sh && ros2 topic echo /emg/raw --once'
docker compose exec ros2 bash -lc \
  'source /gressus/docker/ros-env.sh && ros2 topic hz /emg/raw'
```

Ожидание при shown `Emg 2kHz`: `sample_rate_hz: 2000`, slots `1..16`,
непустой `samples_per_channel` и стабильная частота кадров. Значения около
границ диапазона при неподключённых электродах не являются проверкой качества
физиологического EMG.

## Обновление Windows bridge

Не обновляйте EXE во время работы watchdog. В Administrator PowerShell:

```powershell
$task = "Gressus Cometa Bridge Watchdog"
Stop-ScheduledTask -TaskName $task -ErrorAction SilentlyContinue
Get-Process wavex-bridge -ErrorAction SilentlyContinue | Stop-Process -Force

Set-Location C:\insolex_server\wavex_bridge
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\run.ps1 `
  -ForceRebuild -BuildOnly
powershell.exe -NoProfile -ExecutionPolicy Bypass -File `
  .\install-windows-bridge-watchdog-task.ps1 `
  -EmgSensors "1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16"
```

Linux firewall должен persistent-разрешать TCP `{ 9100, 9101 }` от
`192.168.122.0/24` на `virbr0`.
