# Операторский runbook

Штатная процедура запуска и ручной fallback. Runtime replug recovery уже
автоматизирован двумя watchdog'ами; cold boot Linux-хоста пока начинается
вручную через preflight.

## 1. Проверить Linux-инфраструктуру

```bash
systemctl is-active virtqemud.socket virtnetworkd.socket virtlogd.socket virtstoraged.socket
virsh -c qemu:///system net-list --all
lsusb | rg '04b4:01aa|04b4:4720'
```

Ожидание: все сервисы `active`, сеть `default` — `active` и `autostart yes`,
виден один receiver. Дополнительно при runtime automation:

```bash
systemctl is-active gressus-cometa-runtime-watchdog.service
```

Он должен вернуть `active`. Receiver может штатно быть `4720` сразу после
подключения: Linux watchdog переведёт его в `01aa` только при работающей VM.

Если сеть inactive:

```bash
virsh -c qemu:///system net-start default
```

Если PID не совпадает с закреплённым в VM, не стартуйте её вслепую: перейдите в
[RECOVERY.md](RECOVERY.md).

## 2. Запустить ROS listener

```bash
ros2 launch gressus_bringup insole.launch.py
ss -ltn | rg ':9100'
```

Ожидается `0.0.0.0:9100`. Вместо этого допустим запуск игры в `mode:=full`,
если он в вашей конфигурации уже включает insole node. Не запускайте оба:
порт `9100` может слушать только один процесс.

## 3. Запустить Windows VM

После полного reboot предпочитайте cold-boot preflight из корня репозитория:

```bash
third_party/insolex_server/wavex_bridge/cometa-cold-boot-preflight.sh
third_party/insolex_server/wavex_bridge/cometa-cold-boot-preflight.sh --apply
```

Первый вызов ничего не меняет. Второй работает только при `shut off`: если
receiver уже `01aa`, он запускает VM; если receiver `4720`, он временно
запускает VM с этим PID, ждёт пока Windows Cometa driver переведёт устройство
в `01aa`, затем переключает live и persistent USB passthrough на `01aa`.
Он не запускает WaveX bridge и не меняет RF configuration. Если preflight
закончился ошибкой, не запускайте WaveX; путь восстановления будет напечатан
в terminal.

Если preflight не нужен, обычный ручной запуск:

```bash
virsh -c qemu:///system start gressus-insole-windows
virsh -c qemu:///system list --all
```

Ожидание: `running`. До настройки RDP графический доступ:

```bash
virt-viewer --connect qemu:///system gressus-insole-windows
```

В Windows проверить путь до ROS:

```powershell
Test-NetConnection 192.168.122.1 -Port 9100
```

Ожидание: `TcpTestSucceeded : True`.

## 4. Захват в Windows

### Обычный автоматический путь

После загрузки Windows Scheduled Task `Gressus Cometa Bridge Watchdog` сам
наблюдает `01aa` и запускает подготовленный bridge на следующем PnP poll.
Проверка из Windows:

```powershell
Get-ScheduledTask -TaskName "Gressus Cometa Bridge Watchdog" | Select-Object TaskName,State
Get-Process wavex-bridge -ErrorAction SilentlyContinue
```

Должен быть один `wavex-bridge` в `SI 0` (LocalSystem). Не запускайте вручную
watchdog или `run.ps1` параллельно: два bridge конкурируют за один receiver.

### Ручной fallback

Закройте EMG & Motion Tools и WaveX.Example. Откройте PowerShell **as
Administrator**:

```powershell
Set-Location C:\insolex_server
powershell.exe -ExecutionPolicy Bypass -File .\wavex_bridge\run.ps1 --tcp 192.168.122.1 9100 --rf-start
```

Признаки успеха:

```text
RF start: configuration read-back confirmed (L=enabled, R=enabled,
PROPRIETARY_PROTOCOL, Insole_100Hz).
TCP connected to 192.168.122.1:9100.
Capturing started ... JSONL: raw FSR batches.
```

Без `--rf-start` bridge может подключиться, но отправлять нули
(`InsoleScanNumber=0`). Ручной bridge перед включением Scheduled Task
необходимо остановить (`Ctrl+C`), иначе появятся два процесса.

## 5. Проверить ROS данные

```bash
ros2 topic echo /insole/pressure --once
ros2 topic hz /insole/pressure
```

Успех: `connected: true`, по 64 значения слева/справа, ненулевая частота и
значения меняются при нажатии на стельку.

## Нормальная остановка

1. При ручном bridge: `Ctrl+C`. При Scheduled Task: остановить task и bridge:

   ```powershell
   Stop-ScheduledTask -TaskName "Gressus Cometa Bridge Watchdog"
   Get-Process wavex-bridge -ErrorAction SilentlyContinue | Stop-Process -Force
   ```
2. Остановить ROS launch: `Ctrl+C`.
3. Выключить Windows из Start menu, затем проверить:

   ```bash
   virsh -c qemu:///system list --all
   ```

Ожидается `shut off`. `virsh destroy` — аварийная мера, эквивалент
отключения питания Windows.
