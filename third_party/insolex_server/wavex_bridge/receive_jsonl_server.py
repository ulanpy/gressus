#!/usr/bin/env python3
"""
Приём потока с Windows-клиента ``wavex-bridge`` по TCP в формате JSONL.

Протокол на транспортном уровне
-------------------------------
- Одно постоянное TCP-соединение (клиент подключается к этому процессу).
- Каждое сообщение приложения — **одна текстовая строка**, кодировка **UTF-8**,
  завершение строки символом **newline** ``\\n`` (NDJSON / JSON Lines).
- Пустые строки игнорируются.

Структура одного JSON-объекта (поля могут добавляться; парсить лучше через ``dict``)
------------------------------------------------------------------------------------
``seq`` (int):
    Номер кадра, монотонно растёт на стороне Windows.
``ts`` (str):
    Метка времени UTC события, ISO 8601, например ``2026-05-09T17:00:00.1234567Z``.
``dtMs`` (float):
    Интервал в мс между предыдущим и текущим событием ``DataAvailable`` на клиенте.
``rate`` (int):
    Служебное поле скорости от SDK WaveX (`DataTransferRate`).
``insoleScans`` (int):
    Сколько сырых сканов включено в эту строку / пачку буфера.
``insoleStates`` (list[int], необязательно):
    По одному элементу состояния (``short``) на стельку; см. SDK «Sensors State».
``L_online``, ``R_online`` (bool, необязательно):
    Левая / правая стелька на связи (`InsoleStates[i] != 0` на клиенте).
``L``, ``R`` (list[list[float]] | null):
    Сырые давления по FSR в кПа. Структура ``[номер скана][0..63]`` — массив из
    ``insoleScans`` вложенных массивов по 64 значения для левой/правой стельки.
    Если данных нет — ключи могут быть ``null``.

Запуск
------
  python3 receive_jsonl_server.py 0.0.0.0 9100

Это отладочный приёмник. В рабочем контуре порт 9100 должен принадлежать
``ros2 launch gressus_bringup insole.launch.py``; не запускайте оба процесса
одновременно.

Вывод этого скрипта: каждую успешно разобранную строку печатает в stdout тем же JSON
компактно (в своём пайплайне замените на запись в БД / очередь / игровой цикл).

Ограничения
-----------
- Принимается только **один** одновременный клиент после ``accept()``; второй нужно ждать
  перезапуска процесса или изменить логику на цикл ``accept``.
"""
from __future__ import annotations

import json
import socket
import sys


def main() -> None:
    """Слушает ``HOST``/``PORT``, принимает соединение, читает JSONL построчно."""

    host = "0.0.0.0"
    port = 9100
    if len(sys.argv) >= 2:
        host = sys.argv[1]
    if len(sys.argv) >= 3:
        port = int(sys.argv[2])

    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.bind((host, port))
    sock.listen(1)
    print(f"Listening on {host}:{port} (waiting for wavex-bridge)...", flush=True)

    conn, addr = sock.accept()
    print(f"Client connected from {addr}", flush=True)
    sock.close()

    try:
        with conn.makefile("rb") as rf:
            while True:
                chunk = rf.readline()
                if not chunk:
                    break
                line = chunk.decode("utf-8", errors="replace").strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                    # Print compact one-line confirmation; replace with your pipeline.
                    print(json.dumps(obj, separators=(",", ":"), ensure_ascii=False), flush=True)
                except json.JSONDecodeError as e:
                    print(f"# bad json: {e}: {line[:200]}", file=sys.stderr, flush=True)
    finally:
        conn.close()
        print("Connection closed.", flush=True)


if __name__ == "__main__":
    main()
