# Treadmill feedback game (прототип)

Проектор на стену/пол + камера (Orbbec RGB по USB2, часто `/dev/video2`, MJPEG 1920×1080 ~3 fps). Калибровка AprilTag → `config/calibration.json` → игра по окклюзии.

**Окклюзия, тень и планы под дорожку** (почему в RGB попадает тень, зачем depth, свет и установка): [docs/occlusion-and-treadmill.md](docs/occlusion-and-treadmill.md).

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
src/calibration.py
scripts/calibrate_apriltag.py
scripts/adjust_projection_quad.py
scripts/occlusion_game.py
scripts/display_utils.py
```

## Лицензия

Не выбрана.
