# Treadmill feedback game (прототип)

Проектор на стену/пол + камера. Актуальная конфигурация: **Frbby P40 Pro** + **Intel RealSense D435**. Основной сценарий: **depth** (aligned-to-color), калибровка по AprilTag в `config/calibration.json`, игра **`tile_game.py`** (дорожки + плитки), опционально подтверждение шага по давлению Insolex.

**Окклюзия, тень и планы под дорожку** (почему в RGB попадает тень, зачем depth, свет и установка): [docs/occlusion-and-treadmill.md](docs/occlusion-and-treadmill.md).

**Актуальные спеки железа и план миграции на D435**: [docs/system-spec.md](docs/system-spec.md).

**Координаты сенсоров стельки размера M** (лев/прав): [docs/insole-sensors-m.md](docs/insole-sensors-m.md).

**Приём давления со стороны Windows (TCP JSONL)** — см. docstring [`scripts/listener.py`](scripts/listener.py).

**Веб-визуализация давления (FastAPI + React/Vite)**

Backend принимает реальные кадры Insolex/WaveX по TCP JSONL на `0.0.0.0:9100` и отдаёт их во фронт по WebSocket. В UI можно переключиться на mock-режим без стелек.

```bash
poetry run uvicorn src.insole_pressure_web:app --host 0.0.0.0 --port 8000
```

В отдельном терминале:

```bash
cd frontend
deno task dev
```

Откройте `http://localhost:5173`. Для размера стельки используйте переключатель `M/S` в интерфейсе. Если нужен другой порт TCP для bridge:

```bash
INSOLE_PORT=9101 poetry run uvicorn src.insole_pressure_web:app --host 0.0.0.0 --port 8000
```

**Старый режим только визуализации давления (stdin JSONL)**

```bash
poetry run python scripts/listener.py 0.0.0.0 9100 \
  | QT_QPA_PLATFORM=xcb poetry run python scripts/insole_pressure_viz.py --size m
```

Без стелек — мок-шаг для отладки дизайна:

```bash
QT_QPA_PLATFORM=xcb poetry run python scripts/insole_pressure_viz.py --mock --size m
```

Для размера стельки **S** подставьте `--size s`. Пакеты: `numpy`, `pygame`, `opencv` (Poetry).

## Текущее железо (май 2026)

- **Проектор**: `Frbby P40 Pro` (FHD 1920x1080, LED, vertical/horizontal keystone, motorized focus/zoom/lens shift по данным поставщика).
- **Камера (целевая)**: `Intel RealSense D435` (stereo depth + RGB).
- **Практический вывод**: проектор под углом к ленте требует pre-warp (см. `scripts/adjust_projection_quad.py`), а стабильный трекинг стоп/ног лучше строить по depth, не по яркости RGB.

## Зависимости

```bash
poetry install
```

## Калибровка (AprilTag на проекторе)

Калибровку лучше делать через **RealSense color stream**, чтобы не выбирать вручную `/dev/videoN`.

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

Enter — сохранить, Esc — выход, S — снимок `calibrate_debug.jpg` (файл в `.gitignore`).

## Подгонка формы проекции на ленте / полу (pre-warp)

Проектор под углом к поверхности → «полный кадр» ложится трапецией. Этот скрипт позволяет выбрать 4 угла внутри трапеции так, чтобы на ленте получился честный прямоугольник, и сохраняет их в `config/calibration.json` как `proj_quad`.

```bash
poetry run python scripts/adjust_projection_quad.py -d 1
```

Клавиши: `1/2/3/4` — выбрать угол (TL/TR/BR/BL), `h j k l` или стрелки — двигать, `Shift` — шаг ×10, `[` / `]` — размер шага, `g` — тест‑паттерн (grid / checker / solid), `r` — сброс на полный экран, `Enter`/`S` — сохранить, `Esc` — выход. Ориентируйтесь по сетке: клетки должны быть равными квадратами **на ленте**, а не на проекторе.

Сохранение не затирает поля от AprilTag‑калибровки — в тот же JSON добавляются `proj_quad`, `proj_quad_resolution`, `logical_size`.

## RealSense debug (без проектора)

Пока нет проектора, можно отдельно проверить depth/RGB потоки D435 и baseline depth-сегментацию «пол vs человек».

```bash
# 1) Просмотр color + depth, FPS, USB режима
QT_QPA_PLATFORM=xcb poetry run python scripts/realsense_depth_preview.py --align-to-color

# 2) Сегментация по глубине: SPACE = снять пустой пол, дальше маска "ближе пола"
QT_QPA_PLATFORM=xcb poetry run python scripts/realsense_floor_debug.py --align-to-color --lift-mm 70
```

Если видите "Couldn't resolve requests" или "Frame didn't arrive within 5000", задайте более лёгкий профиль вручную:

```bash
poetry run python scripts/realsense_depth_preview.py --align-to-color \
  --depth-width 640 --depth-height 480 --depth-fps 15 \
  --color-width 640 --color-height 480 --color-fps 15
```

Если OpenCV падает с ошибкой Qt/Wayland, запускайте с `QT_QPA_PLATFORM=xcb`.

## Игра по плиткам (2 дорожки, depth + RGB + Insolex)

Две дорожки (LEFT/RIGHT), плитки падают сверху вниз. Попадание по плитке регистрируется когда совпадают **три сигнала**, измеренные **в зоне самой плитки** (а не «где-то на полу»):

1. **D**epth — доля depth-пикселей внутри плитки с подъёмом в диапазоне **40–250 мм** над baseline-полом.
2. **R**GB occlusion — доля пикселей в плитке, **не подсвеченных проектором** (свет блокирован стопой/тенью).
3. **P**ressure — давление соответствующей стельки выше `--insole-thresh-kpa`.

Условие хита: **`D AND R AND P`**. Точки D/R/P над плиткой — зелёные, когда порог достигнут.

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

**Скорость:** `-S` / `--speed` / `--treadmill-speed-mps` — одно и то же, число в диапазоне **0.05–1.5** (условные «м/с» вдоль ленты). Внутри переводится в `px/s = speed * 420`, затем ограничивается **~45–620 px/s**. Значение **4.0** будет обрезано до **1.5** — это максимум; для «быстрее» сначала крути `--step-time-s` вниз (чаще новые плитки), потом `--speed` вверх до ~1.0–1.5. В HUD видно фактические `speed: …px/s (~… m/s)`.

**Сдвиг проекции:** стрелки `←→↑↓` (Shift = шаг ×5), затем **`S`** — запись `hit_shift_canvas` в тот же `--calibration` JSON.

Без стелек: `--no-insole` (gate P всегда true).

Шаги:
- встаньте **вне** зоны проекции;
- `SPACE` — снять модель пустого пола (depth + RGB baseline) и начать раунд;
- наступайте поочерёдно левой/правой ногой, когда плитка под ногой;
- `R` — сброс счёта, `Esc/Q` — выход.

Флаги: `--calibration`, `-d/--display`, `--output-rotation`, `--no-insole`, `--insole-port`, `--insole-thresh-kpa`, `-S/--speed/--treadmill-speed-mps`, `--step-time-s`.

### Разрешение: калибровка и игра

В JSON сохраняются `camera_resolution` и `proj_resolution`. Игра работает с тем же монитором (`-d`) и тем же разрешением проектора, что при калибровке; разрешение камеры фиксированно 640×480.

## Структура репозитория

| Путь | Назначение |
|------|------------|
| `scripts/listener.py` | TCP-сервер: принимает JSONL от Windows WaveX-bridge, печатает компактный JSON в stdout (для пайпа в визуализатор или лог). |
| `config/calibration.json` | Результат калибровки: гомография камера→проектор, разрешения, опционально `proj_quad`. Локальная машина — коммитить по желанию. |
| `src/calibration.py` | Загрузка JSON и `cam_to_proj(x, y, frame_w)` для проекции точки кадра в координаты проектора. Используется в `tile_game.py`, `calibrate_apriltag.py`, `adjust_projection_quad.py`. |
| `src/insole_stream.py` | Общий приём Insolex: парсинг последнего кадра L/R, статистика давления, TCP receiver в фоне. Используется в `tile_game.py` и `insole_pressure_viz.py`. |
| `src/insole_sensors_m.py` | Координаты 64 сенсоров стельки **M** (мм) для визуализации. |
| `src/insole_sensors_s.py` | То же для размера **S** (`--size s` в визуализаторе). |
| `scripts/tile_game.py` | Основная игра: RealSense, плитки, звук, опционально Insolex по TCP. |
| `scripts/insole_pressure_viz.py` | 2D-градиент давления по сенсорам (stdin JSONL); `--size m\|s`, `--mock`. |
| `scripts/calibrate_apriltag.py` | Калибровка AprilTag 36h11 с проектора в `calibration.json`. |
| `scripts/adjust_projection_quad.py` | Pre-warp четырёхугольника проекции на ленту. |
| `scripts/realsense_depth_preview.py` | Отладка потоков depth/color. |
| `scripts/realsense_floor_debug.py` | Отладка сегментации «пол / человек» по глубине. |
| `scripts/display_utils.py` | `open_fullscreen()` для pygame (выбор дисплея). |
| `docs/occlusion-and-treadmill.md` | Заметки про тень/окклюзию и почему depth. |
| `docs/insole-sensors-m.md` | Таблица координат M. |
| `docs/system-spec.md` | Железо и планы. |

## Лицензия

Не выбрана.
