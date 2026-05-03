# System Spec (May 2026)

Краткая фиксация актуального железа и практических требований для следующей итерации.

## 1) Hardware baseline

### Projector: Frbby P40 Pro

По данным поставщика/карточки товара:

- Native output: 1920x1080 (16:9), LED.
- Throw distance: ~0.5-4.0 m.
- Keystone: vertical/horizontal.
- Claimed features: motorized focus, motorized zoom, lens shift.

Engineering implications:

- При установке под углом к ленте «прямоугольник» на поверхности становится трапецией.
- Для игровой геометрии используем программный pre-warp через `scripts/adjust_projection_quad.py` и `proj_quad` в `config/calibration.json`.
- Keystone проектора можно использовать как coarse correction, но финальная форма должна фиксироваться в нашем JSON для воспроизводимости.

### Camera: Intel RealSense D435

Практически важное для проекта:

- Active stereo depth + RGB.
- Depth sensor: global shutter (лучше для движения, чем rolling shutter в RGB).
- Depth output: до 1280x720, до 90 FPS (зависит от выбранного режима).
- RGB: до 1920x1080 @ 30 FPS.
- Typical reliable range для задач дорожки: ~0.3-3 m (возможен больший, но хуже стабильность/точность).

## 2) Capture stack decision

Для D435 в проекте используем **Intel RealSense SDK 2.0**:

- Runtime: `librealsense` (`realsense2_camera`, `rs-enumerate-devices`, etc.).
- Python: `pyrealsense2`.

Почему не «сырые» `/dev/video*`:

- `/dev/video*` обычно даёт только цвет/IR как обычный V4L2 поток, но не полный контролируемый depth pipeline.
- Теряются удобные SDK-функции: `align` (depth-to-color), профили стримов, временная синхронизация, фильтры depth, metadata.
- Для стабильной сегментации стоп/ног depth-ветка должна быть под контролем SDK, а не собрана из разрозненных v4l2 каналов.

## 3) Recommended D435 pipeline (next implementation)

1. Configure streams:
   - Depth: `848x480@30` (или `640x480@30`) как стартовый realtime профиль.
   - Color: `1280x720@30` или `1920x1080@30` по нагрузке.
2. `align = rs.align(rs.stream.color)` чтобы depth и RGB были в одной системе пикселей.
3. Depth preprocessing:
   - decimation, spatial, temporal, hole-filling filters (минимально необходимый набор).
4. Build floor model (ROI дорожки) и порог по высоте относительно пола.
5. Считаем centroid/foot-contact в координатах «пола», потом маппим в проекцию через `H_cam_to_proj` (+ `proj_quad` если включен pre-warp).

## 4) Calibration and operations checklist

- Любой сдвиг камеры/проектора => повторная калибровка.
- `--width/--height` в игре и в калибровке держать согласованными.
- Для дорожки критичны: стабильный свет, минимизация бликов, фиксированная экспозиция камеры.
- Для демонстраций: сначала подогнать форму проекции (`adjust_projection_quad.py`), потом ловить background/depth.

## 5) Open items

- [done] `scripts/realsense_depth_preview.py` добавлен (debug depth/color, FPS, USB mode, clipping range).
- Добавить новую игру/режим с depth-сегментацией вместо RGB `absdiff`.
- [in progress] `scripts/realsense_floor_debug.py` добавлен как промежуточный режим (SPACE -> floor model -> depth mask).
- Отдельно проверить, какие функции Frbby P40 Pro реально доступны в конкретной поставке (zoom/lens shift/keystone), и зафиксировать фактические лимиты после стендовых тестов.
