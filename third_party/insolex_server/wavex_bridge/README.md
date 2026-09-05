# InsoleX / WaveX bridge

Рабочий контур для запуска Windows-only Cometa WaveX SDK на том же Linux-хосте,
где работает Gressus. Ручной запуск, runtime USB replug recovery и фоновые
watchdog'и проверены 2026-09-02.

```text
Cometa receiver ─USB passthrough─> Windows 11 VM ─TCP JSONL─> Gressus ROS 2
      04b4:01aa                         WaveX bridge       192.168.122.1:9100
                                                              │
                                                    /insole/pressure
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

## Обычная работа после настройки

1. Linux: `ros2 launch gressus_bringup insole.launch.py`.
2. Убедиться, что Linux recovery service активен:

   ```bash
   systemctl is-active gressus-cometa-runtime-watchdog.service
   ```

3. VM уже должна быть `running`, а Windows Scheduled Task
   `Gressus Cometa Bridge Watchdog` — `Running`. Не запускайте второй
   экземпляр `run.ps1` или `windows-bridge-watchdog.ps1` вручную.
4. Подключите receiver. При runtime unplug/replug автоматическая цепочка
   восстанавливает `4720 → 01aa` и запускает prepared
   `wavex-bridge.exe --rf-start` на следующей PnP-проверке Windows.

## Сеанс и проектор из Gressus

После запуска `insole.launch.py` оператор работает из веб-таба **Sessions**:

1. Выбрать пациента прямо в табе **Sessions**. Стельки и P.GEAR показаны
   только как статусы готовности: терапевт не запускает эти источники из UI.
2. Нажать **Начать**. Это создаёт клинический сеанс и rosbag со всеми
   доступными ROS topic, без выбора отдельных источников.
3. После старта появляется блок **Игра**. В нём доступны калибровка,
   «Камера + стельки» и «Только камера». Режим со стельками использует уже
   работающий `/insole/pressure`; второй listener TCP `:9100` не поднимается.
4. Все процессы проектора, запущенные из активного сеанса, принадлежат ему и
   останавливаются при **Завершении** вместе с закрытием rosbag.
5. Linux: `ros2 topic echo /insole/pressure --once`.

`--rf-start` сейчас необходим для cold state: он включает обе стельки и
задаёт `PROPRIETARY_PROTOCOL / Insole_100Hz` через штатные WaveX
`ConfigureCapture` + `UpdateDisplay`. Затем он выполняет короткую wake-up
запись в память сенсоров — для этой firmware это часть включения RF-канала.

До reboot drill не включайте autostart VM: receiver менял PID между
`04b4:4720` и `04b4:01aa`, а libvirt хранит привязку к одному PID.

После полного reboot используйте сначала `cometa-cold-boot-preflight.sh`; он
подготавливает USB receiver и запускает VM, но не запускает сам preflight
автоматически. Когда Windows загрузится, её Startup Task уже сам поднимет
bridge.

Ручной fallback, первый запуск и диагностические команды — в
[RUNBOOK.md](RUNBOOK.md). Runtime recovery и ограничения automation — в
[RECOVERY.md](RECOVERY.md).
