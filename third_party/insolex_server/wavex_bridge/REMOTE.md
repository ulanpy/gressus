# Передача JSONL в Gressus на том же Linux-хосте

На Linux запустите приёмник:

```bash
ros2 launch gressus_bringup insole.launch.py
```

На Windows запустите read-only relay:

```powershell
powershell.exe -ExecutionPolicy Bypass -File "C:\insolex_server\wavex_bridge\run.ps1" --tcp 192.168.122.1 9100
```

Для холодного запуска RF-стелек выключите ресивер, добавьте `--rf-start`, а
затем включите ресивер после сообщения ожидания:

```powershell
powershell.exe -ExecutionPolicy Bypass -File "C:\insolex_server\wavex_bridge\run.ps1" --rf-start --tcp 192.168.122.1 9100
```

Для одновременного вывода JSON в Windows-консоль добавьте
`--mirror-stdout`.

Проверка доступности порта из Windows:

```powershell
Test-NetConnection -ComputerName 192.168.122.1 -Port 9100
```

Протокол: UTF-8 JSONL — один JSON-объект на строку, разделитель `\n`.
При разрыве соединения мост продолжает захват и пытается переподключиться.
