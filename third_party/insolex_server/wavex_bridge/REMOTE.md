# Передача pressure и raw EMG в Gressus на том же Linux-хосте

На Linux ROS container уже поднимает оба listener:

```bash
docker compose ps ros2
ss -ltn | rg ':(9100|9101)'
```

На Windows ручной fallback запускает оба current source:

```powershell
powershell.exe -ExecutionPolicy Bypass -File "C:\insolex_server\wavex_bridge\run.ps1" --rf-start --tcp 192.168.122.1 9100 --emg-tcp 192.168.122.1 9101 --emg-sensors 1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16
```

Для одновременного вывода JSON в Windows-консоль добавьте
`--mirror-stdout`.

Проверка доступности порта из Windows:

```powershell
Test-NetConnection -ComputerName 192.168.122.1 -Port 9100
Test-NetConnection -ComputerName 192.168.122.1 -Port 9101
```

Pressure protocol: UTF-8 JSONL, один объект на строку, разделитель `\n`.
EMG protocol: binary `GEMG` frames, channel-major, with the exact SDK batch
length in `samples_per_channel`; `Emg 2kHz` is the saved hardware rate. IMU
не передаётся. При разрыве connection bridge продолжает capture, pressure
reconnects independently and EMG writer holds a bounded retry queue. See
[EMG.md](EMG.md) for the exact frame contract.
