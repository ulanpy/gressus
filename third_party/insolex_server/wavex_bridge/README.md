# InsoleX / WaveX bridge

Рабочий контур для запуска Windows-only Cometa WaveX SDK на том же Linux-хосте,
где работает Gressus. Linux VM supervisor запускает Windows только при
подключённом Cometa receiver; runtime USB replug и bridge управляются
watchdog'ами.

```text
Cometa receiver ─USB passthrough─> Windows 11 VM ─TCP─> Gressus ROS 2
      04b4:01aa                         WaveX bridge   :9100 JSONL -> /insole/pressure
                                                          :9101 binary -> /emg/raw
```

VM и ROS находятся в закрытой сети libvirt; Tailscale и внешний проброс портов
не нужны.

## Документы

| Документ | Назначение |
| --- | --- |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Компоненты, термины и границы ответственности. |
| [RUNBOOK.md](RUNBOOK.md) | Обычный запуск после включения или reboot. |
| [RECOVERY.md](RECOVERY.md) | Диагностика типовых сбоев. |
| [INVENTORY.md](INVENTORY.md) | Known-good конфигурация, пути и бэкап. |
| [FRESH_HOST.md](FRESH_HOST.md) | Ручное развёртывание на другом Linux-хосте. |
| [REBOOT_DRILL.md](REBOOT_DRILL.md) | Контролируемая проверка после перезагрузки. |
| [EMG.md](EMG.md) | Проверенный raw EMG contract, slots, batch format и проверки. |

## Обычная работа после настройки

1. ROS container уже автоматически запускает `runtime.launch.py`, включающий
   pressure listener `:9100` и EMG listener `:9101`.
2. Убедиться, что Linux recovery service активен:

   ```bash
   systemctl is-active gressus-cometa-runtime-watchdog.service
   ```

3. При подключённом receiver Linux VM supervisor сам приводит VM к `running`,
   а Windows Scheduled Task `Gressus Cometa Bridge Watchdog` — к `Running`.
   Не запускайте второй
   экземпляр `run.ps1` или `windows-bridge-watchdog.ps1` вручную.
4. Подключите receiver. При runtime unplug/replug автоматическая цепочка
   восстанавливает `4720 → 01aa` и запускает prepared
   `wavex-bridge.exe --rf-start` на следующей PnP-проверке Windows.

## Сеанс и проектор из Gressus

После autostart ROS runtime оператор работает из веб-таба **Sessions**:

1. Выбрать пациента прямо в табе **Sessions**. Стельки и P.GEAR показаны
   только как статусы готовности: терапевт не запускает эти источники из UI.
2. Нажать **Начать**. Это создаёт клинический сеанс и rosbag со всеми
   доступными ROS topic, без выбора отдельных источников.
3. После старта появляется блок **Игра**. В нём доступны калибровка,
   «Камера + стельки» и «Только камера». Режим со стельками использует уже
   работающий `/insole/pressure`; второй listener TCP `:9100` не поднимается.
4. Все процессы проектора, запущенные из активного сеанса, принадлежат ему и
   останавливаются при **Завершении** вместе с закрытием rosbag.
5. Linux: проверить `/insole/pressure`; для EMG check — `/emg/raw` по
   [EMG.md](EMG.md).

## Raw EMG recording

Current deployment streams WaveX EMG slots `1..16` on `:9101`; InsoleX slots
`17,18` are excluded. IMU is intentionally not transported. The full data
contract, configured 2 kHz rate, actual-batch semantics, Windows task command
and ROS checks are in [EMG.md](EMG.md).

`--rf-start` сейчас необходим для cold state: он включает обе стельки и
задаёт `PROPRIETARY_PROTOCOL / Insole_100Hz` через штатные WaveX
`ConfigureCapture` + `UpdateDisplay`. Затем он выполняет короткую wake-up
запись в память сенсоров — для этой firmware это часть включения RF-канала.

Не включайте libvirt autostart VM: receiver меняет PID между
`04b4:4720` и `04b4:01aa`, а libvirt хранит привязку к одному PID.

После полного reboot подключённый receiver замечает Linux VM supervisor: он
запускает `cometa-cold-boot-preflight.sh --apply`, который подготавливает USB
receiver и запускает VM. Когда Windows загрузится, её Startup Task сам
поднимет bridge.

Ручной fallback, первый запуск и диагностические команды — в
[RUNBOOK.md](RUNBOOK.md). Runtime recovery и ограничения automation — в
[RECOVERY.md](RECOVERY.md).
