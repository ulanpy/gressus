# Treadmill feedback game (прототип)

Проектор на стену/пол + камера. Актуальная конфигурация: **Frbby P40 Pro** + **Intel RealSense D435**. Основной сценарий: **depth** (aligned-to-color), калибровка по AprilTag в `config/calibration.json`, игра **`tile_game.py`** (дорожки + плитки), опционально подтверждение шага по давлению Insolex.

**Окклюзия, тень и планы под дорожку** (почему в RGB попадает тень, зачем depth, свет и установка): [docs/occlusion-and-treadmill.md](docs/occlusion-and-treadmill.md).

**Актуальные спеки железа и план миграции на D435**: [docs/system-spec.md](docs/system-spec.md).

**Координаты сенсоров стельки размера M** (лев/прав): [docs/insole-sensors-m.md](docs/insole-sensors-m.md).

**Приём давления со стороны Windows (TCP JSONL)** — см. docstring [`scripts/listener.py`](scripts/listener.py).

**Режим только визуализации давления (stdin JSONL)**

```bash
poetry run python scripts/listener.py 0.0.0.0 9100 \
  | QT_QPA_PLATFORM=xcb poetry run python scripts/insole_pressure_viz.py --size m
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

## Игра по плиткам (2 дорожки, depth + ноты; опционально Insolex)

Две дорожки (левая/правая), плитки падают сверху вниз. Трекинг ноги — **RealSense depth**; при включённом Insolex попадание подтверждается давлением соответствующей стельки. Windows-bridge может подключаться **напрямую** к игре по TCP (порт по умолчанию `9100`).

```bash
QT_QPA_PLATFORM=xcb poetry run python scripts/tile_game.py \
  --calibration config/calibration.json \
  -d 0 \
  --lift-mm 40 \
  --min-area 700 \
  --proj-bias-y 60 \
  --output-rotation 90 \
  --insole-host 0.0.0.0 \
  --insole-port 9100 \
  --insole-thresh-kpa 8
```

Без стелек: добавьте `--no-insole`.

Шаги:
- встаньте вне зоны проекции;
- `SPACE` — снять модель пустого пола (depth background) и начать раунд;
- наступайте поочерёдно левой/правой ногой, когда плитка в вашей дорожке;
- `R` — сброс очков/промахов, `Esc/Q` — выход.

Тонкая настройка (см. также `--help`):
- `-S` / `--speed` / `--treadmill-speed-mps` — скорость падения плиток (одно и то же);
- `--step-time-s` — интервал между шагами/плитками;
- `--tile-height-frac` / `--same-lane-gap-frac` — размер плитки и зазор в одной дорожке;
- `--lift-mm`, `--min-area` — сегментация стопы;
- `--proj-bias-y` — смещение по вертикали после гомографии;
- `--output-rotation 0|90|180|270` — поворот финального изображения на проектор;
- `--swap-insole-lanes` — если мостик отдаёт L/R в обратном порядке относительно дорожек.

### Разрешение: калибровка и игра

- **`--color-width` / `--color-height`** в игре задайте **такими же**, как при калибровке AprilTag. В JSON также сохраняется `camera_resolution` — сверяйте с HUD игры.
- **Проектор**: в JSON есть `proj_resolution`. Игра масштабирует точку в текущий экран; надёжнее тот же монитор (`-d`) и то же разрешение, что при калибровке.

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
| `scripts/insole_pressure_viz.py` | 3D/анатомическая визуализация давления из stdin JSONL; `--size m\|s`. |
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
