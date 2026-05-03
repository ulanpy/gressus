# Treadmill feedback game (прототип)

Проектор на стену/пол + камера. Актуальная конфигурация: **Frbby P40 Pro** + **Intel RealSense D435**. Текущий MVP ещё RGB-only (`/dev/video*`), но целевой трекинг для дорожки — по depth через RealSense SDK. Калибровка AprilTag → `config/calibration.json` → игра по окклюзии.

**Окклюзия, тень и планы под дорожку** (почему в RGB попадает тень, зачем depth, свет и установка): [docs/occlusion-and-treadmill.md](docs/occlusion-and-treadmill.md).

**Актуальные спеки железа и план миграции на D435**: [docs/system-spec.md](docs/system-spec.md).

## Текущее железо (май 2026)

- **Проектор**: `Frbby P40 Pro` (FHD 1920x1080, LED, vertical/horizontal keystone, motorized focus/zoom/lens shift по данным поставщика).
- **Камера (целевая)**: `Intel RealSense D435` (stereo depth + RGB).
- **Практический вывод**: проектор под углом к ленте требует pre-warp (см. `scripts/adjust_projection_quad.py`), а стабильный трекинг стоп/ног лучше строить по depth, не по яркости RGB.

## Зависимости

```bash
poetry install
```

## Калибровка (HUD с FPS по центру экрана)

```bash
poetry run python scripts/calibrate_apriltag.py -c /dev/video2 --width 1920 --height 1080 --display 1 -o config/calibration.json
```

Enter — сохранить, Esc — выход, S — снимок `calibrate_debug.jpg`.

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
poetry run python scripts/realsense_depth_preview.py --align-to-color

# 2) Сегментация по глубине: SPACE = снять пустой пол, дальше маска "ближе пола"
poetry run python scripts/realsense_floor_debug.py --align-to-color --lift-mm 70

# Если видите "Couldn't resolve requests", стартуйте c USB2-профилем явно:
poetry run python scripts/realsense_depth_preview.py --align-to-color --depth-width 640 --depth-height 480 --depth-fps 15 --color-width 640 --color-height 480 --color-fps 15
```

Примечание: если в HUD/логе видно `USB: 2.x`, камера в режиме USB 2.0 (ограничения по throughput). Для стабильного depth+RGB лучше USB 3.x.
Если OpenCV падает с ошибкой Qt/Wayland, запускайте с `QT_QPA_PLATFORM=xcb` (или скрипт подставит это автоматически):
`QT_QPA_PLATFORM=xcb poetry run python scripts/realsense_depth_preview.py --align-to-color`.

## Игра (HUD: score + fps)

```bash
poetry run python scripts/occlusion_game.py --calibration config/calibration.json -c /dev/video2 -d 1 --width 1920 --height 1080
```

SPACE — фон без человека, затем игра: зелёное кольцо = вы, красное = цель.

### Разрешение: калибровка и игра

- **`--width` / `--height` у камеры** в игре лучше задать **такими же**, как при калибровке. Гомография `H_cam_to_proj` считается в координатах того кадра, что был при Enter; другой размер кадра — другая геометрия, попадание «поехит».
- **Проектор**: в JSON сохраняется `proj_resolution` (размер полноэкранного окна при калибровке). Игра **масштабирует** точку из этого пространства в текущий экран; надёжнее, если **тот же `-d` / монитор** и **то же фактическое разрешение** выхода, что и при калибровке. Смена только масштаба с тем же соотношением сторон обычно терпима; другой aspect ratio — заметная ошибка по краям.

## Структура

```
config/calibration.json   # после калибровки
docs/occlusion-and-treadmill.md
docs/system-spec.md
src/calibration.py
scripts/calibrate_apriltag.py
scripts/adjust_projection_quad.py
scripts/realsense_depth_preview.py
scripts/realsense_floor_debug.py
scripts/occlusion_game.py
scripts/display_utils.py
```

## Лицензия

Не выбрана.
