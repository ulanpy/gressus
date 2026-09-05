# Архитектура: Linux, VM и WaveX

## Поток данных

```text
Стельки → RF → Cometa USB receiver → USB passthrough → Windows VM
                                                     │ WaveX + wavex-bridge
                                                     ▼ TCP JSONL
                                      192.168.122.1:9100 на Linux host
                                                     ▼
                                      ROS 2 /insole/pressure, WebSocket :8765
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
| Linux runtime watchdog | systemd service, которая при replug переводит hostdev `4720 → 01aa`. |
| Windows bridge watchdog | Scheduled Task LocalSystem, которая наблюдает `01aa` и запускает prepared bridge. |

## Границы ответственности

- libvirt запускает VM, сеть и USB passthrough.
- Windows + EMG & Motion Tools дают vendor runtime и драйвер receiver.
- `wavex-bridge` отдаёт WaveX JSONL в ROS; `--rf-start` намеренно меняет
  временную capture-конфигурацию.
- `insole_bridge_node` — единственный владелец TCP `9100` и publisher ROS.
- nftables/Docker iptables пропускают трафик VM.
- Linux watchdog не запускает выключенную VM: он действует только при
  `running`. Cold boot выполняет отдельный `cometa-cold-boot-preflight.sh`.
- Windows watchdog запускает уже подготовленный `bin\\wavex-bridge.exe`, не
  `run.ps1`: перекомпиляция/копирование DLL во время работающего bridge
  создаёт file-lock race.
- `virt-viewer` — только временная консоль. Его SPICE USB redirection нельзя
  использовать одновременно с libvirt `hostdev` passthrough receiver.

## Критичный USB нюанс

Receiver наблюдался как `04b4:4720` (WestBridge) и `04b4:01aa` (FX3). Libvirt
не умеет правило «любой из PID»: persistent hostdev выбирает один PID. Поэтому
до USB-PID preflight VM запускается вручную. Runtime replug уже
автоматизирован, но host-boot coordinator для автоматического cold boot ещё
не установлен.
