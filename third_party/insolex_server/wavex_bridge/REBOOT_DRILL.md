# Контролируемый reboot drill

Цель: доказать, что система переживает перезагрузку Linux без поиска команд в
истории. Выполняется только в спокойное время, не перед пациентом.

## До reboot

- [ ] При Scheduled Task: остановить task и bridge из раздела «Нормальная
  остановка» [RUNBOOK.md](RUNBOOK.md).
- [ ] Остановить ROS launch.
- [ ] Штатно выключить Windows и получить `shut off` в
  `virsh -c qemu:///system list --all`.
- [ ] Receiver остаётся подключённым к тому же USB-порту.
- [ ] Записать текущий PID: `lsusb | rg '04b4:01aa|04b4:4720'`.
- [ ] Проверить, что `gressus-libvirt-forward.service` и
  `gressus-cometa-runtime-watchdog.service` включены:
  
  ```bash
  systemctl is-enabled gressus-libvirt-forward.service
  systemctl is-enabled gressus-cometa-runtime-watchdog.service
  ```
- [ ] Убедиться, что nftables config содержит persistent разрешение TCP 9100
  для `192.168.122.0/24` до terminal reject/drop.

Последний пункт критичен: временное правило, добавленное командой `nft add`,
после reboot исчезает.

## Reboot

```bash
sudo systemctl reboot
```

## После входа в Linux

Выполнить шаги из [RUNBOOK.md](RUNBOOK.md) строго по порядку:

1. Проверить libvirt services, `default` network и PID receiver.
2. При выключенной VM выполнить cold-boot preflight. Он сам обработает
   различие `4720`/`01aa`; не пытаться запускать VM повторно вручную.
3. Запустить ROS listener и проверить `:9100`.
4. Запустить VM через cold-boot preflight и убедиться, что Windows получила
   сеть.
5. Не открывая `virt-viewer` во время работы receiver, дождаться Windows
   Scheduled Task: он сам запустит bridge после первого PnP-observation `01aa`.
6. Подтвердить ненулевой `/insole/pressure` нажатием на обе стельки.

## Результат

Заполнить после проверки:

| Проверка | Result |
| --- | --- |
| libvirt services and default network | pending |
| receiver PID still matches VM XML | pending |
| Windows can reach `192.168.122.1:9100` | pending |
| Windows Scheduled Task starts WaveX RF bridge | pending |
| ROS pressure is live and non-zero | pending |

Пять `pass` подтверждают текущую границу: runtime replug автоматический, но
сам cold boot всё ещё запускается оператором через preflight. Только после
этого test можно внедрять отдельный host-boot coordinator.
