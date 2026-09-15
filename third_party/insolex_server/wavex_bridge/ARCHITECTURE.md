# Архитектура: Linux, VM и WaveX

## Поток данных

```text
InsoleX slots 17,18 ─RF──┐
EMG slots 1..16 ─────────┼→ Cometa receiver → USB passthrough → Windows VM
                          │                                  │ WaveX + bridge
                          │                                  ├→ :9100 JSONL -> /insole/pressure
                          │                                  └→ :9101 binary -> /emg/raw
                          └──────────────────── Linux ROS container / rosbag -a
```

## Термины

| Термин | Значение в этом проекте |
| --- | --- |
| Linux host | Реальный ноутбук: запускает ROS, Docker и VM. |
| KVM | Модуль ядра (`/dev/kvm`) для аппаратного ускорения CPU QEMU. |
| QEMU | Процесс, который исполняет Windows и эмулирует её устройства. |
| libvirt | Управляет QEMU: хранит описание VM, сеть и USB assignment. |
| domain | Постоянная спецификация VM `gressus-insole-windows`. |
| qcow2 | Файл диска Windows с установленными программами и данными. |
| OVMF/NVRAM | UEFI Windows 11 и его сохраняемое состояние. |
| `virbr0` | Приватный мост host ↔ VM: `192.168.122.0/24`. |
| NAT | Позволяет VM выходить в интернет, не открывая её в LAN. |
| hostdev | Передаёт физический receiver из Linux в Windows. |
| Linux VM supervisor | systemd service, которая запускает/возобновляет VM при подключённом receiver и при replug переводит hostdev `4720 → 01aa`. |
| Windows bridge watchdog | Scheduled Task LocalSystem, которая наблюдает `01aa` и запускает prepared bridge. |

## Границы ответственности

- libvirt запускает VM, сеть и USB passthrough.
- Windows + EMG & Motion Tools дают vendor runtime и драйвер receiver.
- `wavex-bridge` отдаёт WaveX JSONL pressure в ROS; с явными EMG slots он
  также отдаёт binary raw EMG на `:9101`. `--rf-start` намеренно меняет
  временную capture-конфигурацию.
- `insole_bridge_node` — единственный владелец TCP `9100`; `emg_bridge_node`
  — единственный владелец TCP `9101` и publisher `/emg/raw`.
- EMG кадр — channel-major, без агрегации. Bridge requests 50 ms SDK delivery,
  но `samples_per_channel` — фактический размер конкретной пачки. Current
  slots `1..16` — EMG; `17,18` — InsoleX и исключены. IMU выключен.
- EMG & Motion Tools хранит names/side мышц, но raw ROS message хранит только
  slots. `header.stamp` — время приёма Linux, не hardware timestamp. Полный
  контракт — [EMG.md](EMG.md).
- nftables/Docker iptables пропускают трафик VM.
- Linux VM supervisor действует только при видимом receiver. При `shut off`
  запускает cold-boot preflight, при `paused` возобновляет VM, а при runtime
  replug переводит `4720 → 01aa`. При отключённом receiver он не запускает и
  не выключает Windows VM.
- Windows watchdog запускает уже подготовленный `bin\\wavex-bridge.exe`, не
  `run.ps1`: перекомпиляция/копирование DLL во время работающего bridge
  создаёт file-lock race.
- `virt-viewer` — только временная консоль. Его SPICE USB redirection нельзя
  использовать одновременно с libvirt `hostdev` passthrough receiver.

## Current EMG configuration

Physical slots `1..16` are confirmed EMG; `17,18` are InsoleX. Windows Task
passes only `1..16` via `--emg-sensors`; `Emg 2kHz` is the saved hardware
rate. See [EMG.md](EMG.md) for the non-obvious distinction between hardware
sampling and SDK batch delivery.

## Критичный USB нюанс

Receiver наблюдался как `04b4:4720` (WestBridge) и `04b4:01aa` (FX3). Libvirt
не умеет правило «любой из PID»: persistent hostdev выбирает один PID. Linux
VM supervisor использует preflight для cold boot и live recovery для runtime
replug, поэтому VM запускается только после появления receiver на host.
