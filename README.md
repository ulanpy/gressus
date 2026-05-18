# Treadmill feedback game

Интерактивная реабилитация для детей с ДЦП на беговой дорожке: проектор даёт визуальную обратную связь, камера и стельки фиксируют шаг. Прототип на имеющемся стеке (RealSense depth, калибровка AprilTag, опционально Insolex).

## Содержание

1. [О проекте](#1-о-проекте)
2. [Веб-визуализация давления](#2-веб-визуализация-давления)
3. [Прочие команды запуска](#3-прочие-команды-запуска)
4. [Структура репозитория](#4-структура-репозитория)
5. [Документация](#5-документация)

## 1. О проекте

Ребёнок идёт по дорожке и наступает на падающие плитки (левая/правая дорожка). Попадание засчитывается только при согласовании трёх сигналов в зоне плитки: подъём по **depth** над полом, **окклюзия** проецируемого света стопой и **давление** на соответствующей стельке Insolex (`D AND R AND P`). Цель — ритмичная поочерёдная нагрузка и понятная обратная связь без сложного интерфейса.

**Сценарий:** depth (aligned-to-color), калибровка в `config/calibration.json`, основная игра — `scripts/tile_game.py`.

### Железо (май 2026)


| Компонент | Модель               | Заметка                                                                   |
| --------- | -------------------- | ------------------------------------------------------------------------- |
| Проектор  | Frbby P40 Pro        | FHD 1920×1080; под углом к ленте — pre-warp (`adjust_projection_quad.py`) |
| Камера    | Intel RealSense D435 | Stereo depth + RGB; трекинг стоп по depth, не по яркости RGB              |
| Стельки   | Insolex / WaveX      | Давление по TCP JSONL с Windows-bridge (порт по умолчанию `9100`)         |


### Стек


| Слой           | Технологии                                                                      |
| -------------- | ------------------------------------------------------------------------------- |
| Runtime        | Python ≥3.14, [Poetry](https://python-poetry.org/)                              |
| Захват и игра  | OpenCV, NumPy, pygame, pyrealsense2, pupil-apriltags, sounddevice               |
| Давление (веб) | FastAPI, uvicorn; фронт — React/Vite, [Deno](https://deno.land/) (`frontend/`)  |
| Конфиг         | `config/calibration.json` — гомография камера→проектор, `proj_quad`, разрешения |


Установка зависимостей:

```bash
poetry install
```

При ошибках Qt/Wayland в OpenCV-скриптах добавляйте `QT_QPA_PLATFORM=xcb`.

## 2. Веб-визуализация давления

Backend принимает кадры Insolex/WaveX по TCP JSONL на `0.0.0.0:9100` и отдаёт их во фронт по WebSocket. В UI — переключатель mock без стелек и размер стельки **M/S**.

```bash
poetry run uvicorn src.insole_pressure_web:app --host 0.0.0.0 --port 8000
```

В отдельном терминале:

```bash
cd frontend
deno task dev
```

Откройте `http://localhost:5173`. Другой TCP-порт для bridge:

```bash
INSOLE_PORT=9101 poetry run uvicorn src.insole_pressure_web:app --host 0.0.0.0 --port 8000
```

### Старый режим (stdin JSONL, pygame)

```bash
poetry run python scripts/listener.py 0.0.0.0 9100 \
  | QT_QPA_PLATFORM=xcb poetry run python scripts/insole_pressure_viz.py --size m
```

Без стелек — мок для отладки:

```bash
QT_QPA_PLATFORM=xcb poetry run python scripts/insole_pressure_viz.py --mock --size m
```

Для размера **S** — `--size s`.

## 3. Прочие команды запуска

### Калибровка (AprilTag на проекторе)

Через RealSense color stream (без ручного `/dev/videoN`):

```bash
QT_QPA_PLATFORM=xcb poetry run python scripts/calibrate_apriltag.py \
  -c realsense \
  --width 640 \
  --height 480 \
  --fps 30 \
  --display 0 \
  --tag-size 280 \
  --margin 30 \
  -o config/calibration.json
```

Enter — сохранить, Esc — выход, `S` — снимок `calibrate_debug.jpg` (в `.gitignore`).

### Pre-warp проекции на ленту

Четыре угла в `config/calibration.json` как `proj_quad` (не затирает поля AprilTag):

```bash
poetry run python scripts/adjust_projection_quad.py -d 1
```

Клавиши: `1/2/3/4` — угол (TL/TR/BR/BL), `h j k l` или стрелки — сдвиг, Shift — ×10, `[` / `]` — шаг, `g` — паттерн, `r` — сброс, Enter/`S` — сохранить, Esc — выход. Клетки сетки должны быть равными квадратами **на ленте**.

### RealSense debug (без проектора)

```bash
# color + depth, FPS, USB
QT_QPA_PLATFORM=xcb poetry run python scripts/realsense_depth_preview.py --align-to-color

# SPACE = пустой пол, дальше маска «ближе пола»
QT_QPA_PLATFORM=xcb poetry run python scripts/realsense_floor_debug.py --align-to-color --lift-mm 70
```

При «Couldn't resolve requests» / таймауте кадра — облегчённый профиль:

```bash
poetry run python scripts/realsense_depth_preview.py --align-to-color \
  --depth-width 640 --depth-height 480 --depth-fps 15 \
  --color-width 640 --color-height 480 --color-fps 15
```

### Игра по плиткам (`tile_game.py`)

Две дорожки; хит при **D AND R AND P** в зоне плитки:

1. **D** — depth-пиксели с подъёмом **40–250 мм** над baseline-полом.
2. **R** — пиксели, не подсвеченные проектором (окклюзия стопой).                                   
3. **P** — давление стельки выше `--insole-thresh-kpa`.

```bash
QT_QPA_PLATFORM=xcb poetry run python scripts/tile_game.py \
  --calibration config/calibration.json \
  -d 0 \
  --output-rotation 270 \
  --insole-port 9100 \
  --insole-thresh-kpa 8 \
  --speed 0.35 \
  --step-time-s 1.2
```

**Скорость:** `-S` / `--speed` / `--treadmill-speed-mps` — **0.05–1.5** (условные м/с); в px/s: `speed × 420`, лимит ~45–620. Для ускорения сначала уменьшайте `--step-time-s`, затем `--speed` до ~1.0–1.5.

**Сдвиг проекции:** стрелки (Shift = ×5), затем `S` — запись `hit_shift_canvas` в тот же JSON.

Без стелек: `--no-insole`.

**Ход сессии:** встать вне зоны проекции → `SPACE` (baseline пола + старт) → наступать по плиткам поочерёдно → `R` сброс, `Esc`/`Q` выход.

Флаги: `--calibration`, `-d/--display`, `--output-rotation`, `--no-insole`, `--insole-port`, `--insole-thresh-kpa`, `-S/--speed/--treadmill-speed-mps`, `--step-time-s`.

**Разрешение:** в JSON — `camera_resolution`, `proj_resolution`; игра на том же дисплее (`-d`) и разрешении проектора, что при калибровке; камера — 640×480.

## 4. Структура репозитория


| Путь                                              | Назначение                                                        |
| ------------------------------------------------- | ----------------------------------------------------------------- |
| `scripts/listener.py`                             | TCP JSONL от Windows WaveX-bridge → stdout                        |
| `config/calibration.json`                         | Гомография, разрешения, `proj_quad` (локально, коммит по желанию) |
| `src/calibration.py`                              | `cam_to_proj` и загрузка JSON                                     |
| `src/insole_stream.py`                            | Приём Insolex: TCP, парсинг L/R, статистика                       |
| `src/insole_pressure_web.py`                      | FastAPI + WebSocket для веб-визуализации                          |
| `src/insole_sensors_m.py` / `insole_sensors_s.py` | Координаты 64 сенсоров M / S                                      |
| `scripts/tile_game.py`                            | Основная игра                                                     |
| `scripts/insole_pressure_viz.py`                  | 2D-давление (stdin); `--size m|s`, `--mock`                       |
| `scripts/calibrate_apriltag.py`                   | Калибровка AprilTag 36h11                                         |
| `scripts/adjust_projection_quad.py`               | Pre-warp четырёхугольника                                         |
| `scripts/realsense_depth_preview.py`              | Отладка depth/color                                               |
| `scripts/realsense_floor_debug.py`                | Сегментация пол / человек                                         |
| `scripts/display_utils.py`                        | Полноэкранный pygame, выбор дисплея                               |
| `frontend/`                                       | React/Vite UI давления                                            |
| `docs/`                                           | Подробные заметки (см. ниже)                                      |


## 5. Документация


| Документ                                                           | О чём                                           |
| ------------------------------------------------------------------ | ----------------------------------------------- |
| [docs/occlusion-and-treadmill.md](docs/occlusion-and-treadmill.md) | Тень, окклюзия, зачем depth, свет и установка   |
| [docs/system-spec.md](docs/system-spec.md)                         | Железо, pipeline D435, чеклист                  |
| [docs/insole-sensors-m.md](docs/insole-sensors-m.md)               | Координаты сенсоров стельки M                   |
| `[scripts/listener.py](scripts/listener.py)`                       | Приём давления с Windows (TCP JSONL), docstring |


## Лицензия

Не выбрана.