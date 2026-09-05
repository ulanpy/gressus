# Инвентарь известной рабочей конфигурации

Дата фиксации: 2026-09-01. Это known-good snapshot текущего ноутбука, а не
универсальные значения для нового хоста.

## Linux / libvirt

| Поле | Значение |
| --- | --- |
| libvirt domain | `gressus-insole-windows` |
| UUID текущего хоста | `eea7b059-e175-4355-a75d-e5d823ac0043` |
| VM resources | 2 vCPU, 6144 MiB RAM, q35, host-passthrough CPU |
| Firmware | UEFI/OVMF, Secure Boot, swtpm 2.0 |
| Windows disk | `/var/lib/libvirt/images/gressus-insole-windows.qcow2` |
| UEFI variables | `/var/lib/libvirt/qemu/nvram/gressus-insole-windows_VARS.fd` |
| Windows ISO | `/var/lib/libvirt/images/iso/Win11_25H2_English_x64_v2.iso` |
| VirtIO ISO | `/var/lib/libvirt/images/iso/virtio-win-0.1.302.iso` |
| Network | libvirt `default`, NAT, `virbr0`, `192.168.122.0/24` |
| Host address from VM | `192.168.122.1` |
| VM autostart | disabled intentionally до USB PID preflight |
| Linux runtime recovery | `gressus-cometa-runtime-watchdog.service`, enabled; polls once/sec |

Required services: `virtqemud.socket`, `virtnetworkd.socket`,
`virtlogd.socket`, `virtstoraged.socket`.

## USB receiver

| Mode | VID:PID | Template |
| --- | --- | --- |
| Current known-good | `04b4:01aa` (FX3) | `cometa-receiver-usb-01aa.xml` |
| Previously observed | `04b4:4720` (WestBridge) | `cometa-receiver-usb.xml` |

Windows driver `EmgMUsb.inf` supports both IDs.

## Windows software

| Component | Location / status |
| --- | --- |
| Bridge bundle | `C:\insolex_server` |
| USB driver | `C:\insolex_server\EmgMUsb\EmgMUsb.inf`, installed by `pnputil` |
| EMG & Motion Tools | 8.15.13, installed from `third_party/EMGandMotionTools_8.15.13.zip` |
| Preferred WaveX runtime | `C:\Program Files\Cometa S.r.l\EMGandMotionTools` |
| Bridge | `run.ps1 --tcp 192.168.122.1 9100 --rf-start` |
| Automatic bridge | Scheduled Task `Gressus Cometa Bridge Watchdog`, LocalSystem; запускает `bin\\wavex-bridge.exe --rf-start` сразу после PnP-observation `01aa` |

## Network / firewall contracts

| Flow | Contract |
| --- | --- |
| Windows → Gressus | TCP JSONL to `192.168.122.1:9100` |
| Gressus → frontend | WebSocket `:8765/ws/insole` |
| VM → internet | libvirt NAT plus nftables/Docker forwarding rules |
| Firewall scope | TCP 9100 only from `192.168.122.0/24` |

`gressus-libvirt-forward.service` is the reusable Docker forwarding unit; see
[FRESH_HOST.md](FRESH_HOST.md).

## Back up these items

1. `gressus-insole-windows.qcow2` — Windows, installed tools and bridge.
2. Domain XML: `virsh -c qemu:///system dumpxml gressus-insole-windows`.
3. OVMF NVRAM file — preserves UEFI state.
4. `third_party/insolex_server/` and EMG & Motion Tools installer archive.
5. USB templates and these documents.

Copy the VM only after Windows shuts down cleanly. A raw copy of a live qcow2
can be internally inconsistent.
