# Новый Linux-хост: ручное воспроизводимое развёртывание

Это путь для чистого Linux-хоста. Названия пакетов не указаны намеренно:
они различаются между дистрибутивами, а требуемые роли остаются теми же.

## 1. Предусловия и пакеты

Включите Intel VT-x или AMD-V в BIOS/UEFI. Нужны около 6 GiB RAM и 64 GiB
диска для VM. Установите: QEMU system emulator, KVM support, libvirt с
QEMU/network/storage/logging daemons, OVMF/edk2 firmware, swtpm,
virt-install, dnsmasq, virt-viewer, nftables и iptables с nft backend.
Также нужны официальный Windows 11 x64 ISO и `virtio-win.iso`.

## 2. Включить libvirt

```bash
sudo systemctl enable --now virtqemud.socket virtnetworkd.socket virtlogd.socket virtstoraged.socket
sudo usermod -aG libvirt,kvm "$USER"
```

Перелогиньтесь; временно допустимо `newgrp libvirt`. Проверка:

```bash
virsh -c qemu:///system list --all
ls -l /dev/kvm
```

`/dev/kvm` — интерфейс аппаратного ускорения QEMU, не сеть и не USB.

## 3. Сеть VM

```bash
virsh -c qemu:///system net-start default
virsh -c qemu:///system net-autostart default
virsh -c qemu:///system net-list --all
```

Ожидаемая приватная сеть: `virbr0`, gateway `192.168.122.1/24`.

## 4. Создать Windows VM

Положите ISO в читаемую libvirt директорию. Пример:

```bash
virt-install --connect qemu:///system --name gressus-insole-windows --osinfo win11 --memory 6144 --vcpus 2 --cpu host-passthrough --machine q35 --boot uefi --tpm backend.type=emulator,backend.version=2.0,model=tpm-crb --controller type=scsi,model=virtio-scsi --disk path=/var/lib/libvirt/images/gressus-insole-windows.qcow2,size=64,format=qcow2,bus=scsi --cdrom /var/lib/libvirt/images/iso/Win11.iso --disk path=/var/lib/libvirt/images/iso/virtio-win.iso,device=cdrom,bus=sata --network network=default,model=virtio --graphics spice --video virtio --noautoconsole
```

В Windows installer: первый UEFI DVD-ROM; при выборе диска **Load driver** →
`vioscsi/w11/amd64` на VirtIO ISO. Затем запустите
`virtio-win-guest-tools.exe` с VirtIO CD.

Для экрана VM: `virt-viewer --connect qemu:///system gressus-insole-windows`.

## 5. Firewall и Docker

До terminal reject/drop в nftables input добавьте:

```nft
iifname "virbr0" udp dport { 53, 67 } accept comment "allow libvirt DNS and DHCP"
iifname "virbr0" tcp dport 53 accept comment "allow libvirt DNS"
iifname "virbr0" ip saddr 192.168.122.0/24 tcp dport 9100 accept comment "allow WaveX bridge from libvirt VM"
```

Если forward policy drop, добавьте разрешение исходящего трафика VM и ответов:

```nft
ip saddr 192.168.122.0/24 accept comment "allow libvirt guests outbound"
ip daddr 192.168.122.0/24 ct state established,related accept comment "allow replies to libvirt guests"
```

Если `sudo iptables -S FORWARD` показывает `-P FORWARD DROP`, Docker создаёт
второй слой. Установите приложенный unit:

```bash
sudo install -m 0644 third_party/insolex_server/wavex_bridge/gressus-libvirt-forward.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now gressus-libvirt-forward.service
systemctl status gressus-libvirt-forward.service
```

## 6. Windows / vendor software

1. Скопируйте bundle в `C:\insolex_server`.
2. Administrator PowerShell:

   ```powershell
   pnputil /add-driver C:\insolex_server\EmgMUsb\EmgMUsb.inf /install
   ```

3. Установите EMG & Motion Tools из предоставленного Cometa installer.
4. Подключите receiver по XML template, соответствующему текущему `lsusb` PID.
5. Пройдите [RUNBOOK.md](RUNBOOK.md), включая ручной unplug/replug test.
6. После успешного test включите Linux runtime service по [RECOVERY.md](RECOVERY.md)
   и выполните `install-windows-bridge-watchdog-task.ps1` от Administrator.
   Не включайте VM autostart: для полного cold boot пока нужен отдельный
   preflight.
