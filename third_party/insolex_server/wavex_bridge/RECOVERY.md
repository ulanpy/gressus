# Восстановление и диагностика

Проверяйте тракт сверху вниз: физический USB → VM → TCP → ROS. Не
переустанавливайте Windows или driver, пока не нашли уровень разрыва.

## Receiver сменил PID или VM не стартует

```bash
lsusb | rg '04b4:01aa|04b4:4720'
virsh -c qemu:///system dumpxml gressus-insole-windows | rg -C 4 '04b4|01aa|4720'
```

Если PID `lsusb` не совпадает с `product` в XML VM, libvirt может сказать
`Did not find matching USB device`. Templates:

- `cometa-receiver-usb-01aa.xml` — FX3, current known-good;
- `cometa-receiver-usb.xml` — WestBridge, PID `4720`.

Выключите VM. Для перехода `01aa → 4720` удалите старый hostdev и добавьте
новый в persistent конфигурацию:

```bash
virsh -c qemu:///system detach-device gressus-insole-windows --file ./cometa-receiver-usb-01aa.xml --config
virsh -c qemu:///system attach-device gressus-insole-windows --file ./cometa-receiver-usb.xml --config
```

Для обратного перехода поменяйте файлы местами. При работающей VM повторите
операции ещё и с `--live`, но только после успешного `--config`.

Проверка фактического USB внутри QEMU:

```bash
virsh -c qemu:///system qemu-monitor-command gressus-insole-windows --hmp 'info usb'
```

Ожидается `WestBridge` или `FX3` с `ID: hostdev0`.

### Эксперимент: проверить переход `4720 → 01aa`

`4720` — cold USB mode (`Co Generic X USB Device`), а `01aa` — рабочий
WaveX/Daq mode (`EMG and Motion X Device`). Для проверки гипотезы приложен
live-only script; он не меняет persistent XML VM:

```bash
third_party/insolex_server/wavex_bridge/cometa-usb-transition-test.sh
third_party/insolex_server/wavex_bridge/cometa-usb-transition-test.sh --apply
```

Перед `--apply` VM уже должна работать, а WaveX bridge, EMG & Motion Tools и
WaveX.Example должны быть закрыты. Скрипт передаёт `4720` Windows, ожидает до
30 секунд появления `01aa`, а затем подключает `01aa` только live. Если
переход не наблюдается, он завершится без изменения persistent конфигурации.

### Cold boot preflight

После полной перезагрузки USB receiver обычно появляется как `4720`. Для
штатного запуска при выключенной VM используйте
`cometa-cold-boot-preflight.sh --apply`. В отличие от эксперимента выше, он
временно сохраняет `4720` в XML, чтобы VM могла стартовать, а после
подтверждённого перехода сохраняет рабочий `01aa`. Полная процедура и условия
ошибки описаны в [RUNBOOK.md](RUNBOOK.md).

### Runtime USB replug watchdog

Полный recovery после физического unplug/replug требует двух независимых
watchdog'ов:

```text
Linux PID watchdog: 4720 -> live USB recovery -> 01aa in VM
Windows bridge watchdog: PnP 01aa arrival -> prepared wavex-bridge.exe --rf-start
```

Linux script `cometa-runtime-watchdog.sh` действует только когда VM `running`,
persistent XML уже содержит `01aa`, а host видит `4720`; иначе он ничего не
меняет. Он проверяет состояние раз в секунду. Windows также проверяет PnP раз
в секунду и запускает prepared bridge сразу после наблюдения `01aa`; после
неожиданного выхода следующая попытка выполняется на следующем poll. Краткое
исчезновение `01aa` также debounce'ится: отсутствие до 5 секунд игнорируется, а bridge останавливается
после 12 секунд непрерывного отсутствия устройства. Проверка без действий:

```bash
third_party/insolex_server/wavex_bridge/cometa-runtime-watchdog.sh
```

После отдельного runtime replug test его можно установить как system service:

```bash
sudo install -m 0644 third_party/insolex_server/wavex_bridge/gressus-cometa-runtime-watchdog.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now gressus-cometa-runtime-watchdog.service
```

Windows `windows-bridge-watchdog.ps1` не ждёт команды с Linux: он сам следит
за Windows PnP `VID_04B4&PID_01AA`, останавливает bridge при исчезновении USB
и запускает подготовленный `bin\\wavex-bridge.exe --rf-start` при его
появлении на следующем PnP poll. В обратную сторону он различает короткий
PnP-blip и USB re-enumeration: отсутствие до 5 секунд
игнорируется, 5+ секунд с последующим возвращением `01aa` перезапускает
bridge, а 12 секунд отсутствия останавливает его. Это нужно, потому что
работающий WaveX `DaqSystem` не восстанавливает USB hot-plug сам. Он намеренно
не
вызывает `run.ps1`: тот компилирует EXE и копирует DLL, что небезопасно, пока
работающий WaveX process удерживает эти файлы.

После обновления исходников один раз подготовьте runtime из Administrator
PowerShell, когда bridge не запущен:

```powershell
Set-Location C:\insolex_server\wavex_bridge
powershell.exe -ExecutionPolicy Bypass -File .\run.ps1 -BuildOnly
```

Сначала запустите watchdog вручную в Administrator PowerShell. Лишь после
успешного unplug/replug test выполните
`install-windows-bridge-watchdog-task.ps1` от Administrator, чтобы создать
startup task LocalSystem без GUI.

После установки не запускайте параллельно ручной Windows watchdog или
`run.ps1`: должен остаться один `wavex-bridge` в Windows session `0`. Проверка:

```powershell
Get-Process wavex-bridge -ErrorAction SilentlyContinue
```

Чтобы обновить Windows watchdog без создания второго процесса: сначала
`Stop-ScheduledTask`, остановите существующий `wavex-bridge`, замените файл,
затем выполните `Start-ScheduledTask`. Обновление Linux shell script вступает
в силу после `sudo systemctl restart gressus-cometa-runtime-watchdog.service`.

## VM не стартует вообще

```bash
virsh -c qemu:///system list --all
virsh -c qemu:///system start gressus-insole-windows
systemctl is-active virtqemud.socket virtstoraged.socket
```

Если `default` network inactive: `virsh -c qemu:///system net-start default`.
Не удаляйте qcow2, VM XML или NVRAM: это уничтожит рабочее состояние.

## Windows не видит receiver

На Linux сначала подтвердите `hostdev0` командой `info usb` выше. В Windows,
от Administrator:

```powershell
pnputil /scan-devices
pnputil /enum-devices /connected /class USB /ids
Get-PnpDevice -PresentOnly | Where-Object { $_.InstanceId -match 'VID_04B4&PID_(4720|01AA)' } | Format-List Status,Class,FriendlyName,InstanceId
```

Переустановка драйвера только при необходимости:

```powershell
pnputil /add-driver C:\insolex_server\EmgMUsb\EmgMUsb.inf /install
```

## TCP 9100 недоступен из Windows

```bash
ss -ltn | rg ':9100'
sudo nft list chain inet filter input
```

Сначала запустите ROS listener. Затем убедитесь, что до terminal reject/drop
есть правило, разрешающее `virbr0`, подсеть `192.168.122.0/24` и TCP `9100`.

## Bridge пишет `NotConnected`

Это USB/WaveX, не TCP. Проверьте passthrough и Windows device выше. Закройте
EMG & Motion Tools и WaveX.Example: receiver не должен открываться двумя
процессами. Если standalone SDK падает на `NationalInstruments.DAQmx.dll`,
установите EMG & Motion Tools — рабочая схема использует его runtime.

## TCP connected, но давление нулевое

WaveX соединён с receiver, но insoles не прошли RF initialization. Известное
исправление — запуск с `--rf-start`; он должен подтвердить `L=enabled`,
`R=enabled`, `PROPRIETARY_PROTOCOL`, `Insole_100Hz` и `Capturing started`.
Bridge выполняет короткий sensor-memory recording как RF wake-up handshake.
Переходы `RemoteRecording` и `Idle` ожидаются через `StateChanged`, а при
штатном завершении bridge пытается отправить `StopSensorMemoryRecording`.
