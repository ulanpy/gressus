# Roadmap — векторы развития Gressus

Краткая фиксация текущего состояния прототипа и приоритетных направлений после демонстрации на **KIHE-2026** (Almaty, 20–22 May 2026).

Связанные документы: [system-spec.md](system-spec.md), [occlusion-and-treadmill.md](occlusion-and-treadmill.md).

## 1) Текущее состояние

**Что уже работает**

- Multimodal hit gate в `station/runners/tile_game.py`: **D AND R AND P** (depth lift, RGB-окклюзия проектора, давление Insolex).
- RealSense D435: depth aligned-to-color, baseline пола, сигналы в `station/lib/game/realsense_depth.py`.
- AprilTag-калибровка камера–проектор → `config/calibration.json`.
- Web GUI (`frontend/` + `backend/`): Therapist / Control / Patient, live insole heatmaps, запуск игры и калибровки.
- Patient view: сад (`AppleTreeGarden`), голосовые фразы (kk/ru).
- CEMRR-аналитика и progress dashboard во frontend (загрузка CSV, mock history).

**Где прототип, а не продукт**

- Калибровка и геометрия хрупкие: любой сдвиг камеры/проектора требует повторной настройки (`hit_shift_canvas`, `proj_quad`).
- Live-сессия и аналитика прогресса **не связаны**: отчёты строятся из mock/CSV, а не из игры.
- Пороги детекции (`LIFT_MM_MIN`, `RGB_FILL_THRESH` и т.д.) зашиты в код без профиля пациента.
- Нет автотестов; запуск завязан на конкретную машину (display index, RealSense, проектор, Deno + Poetry).

**Вердикт:** сильный KIHE-ready прототип с заделом на клиническую систему. Следующий скачок — надёжность сенсорики, замкнутый цикл данных и клиническая валидация, а не новые визуальные режимы ради демо.

---

## 2) Векторы развития

### 2.1 Надёжность сенсорного контура (приоритет №1)

Самое узкое место — стабильность детекции шага, не UI.

| Задача | Детали |
| ------ | ------ |
| Depth pipeline | Decimation, spatial/temporal filters, hole filling — см. [system-spec.md §3](system-spec.md). |
| Модель пола | Автозахват в начале сессии + контроль дрейфа (не только SPACE один раз). |
| Логика сигналов | Ослабить обязательность RGB там, где depth + insole достаточны; RGB — подтверждение, не жёсткий AND. |
| Калибровка в GUI | Wizard вместо стрелок + `S` в терминале; сохранение `hit_shift_canvas` и `proj_quad` из web Control. |
| Health-check при старте | RealSense FPS, insole latency, совпадение разрешения проектора с `calibration.json`. |

**Цель:** терапевт может провести сессию без ручной отладки порогов.

---

### 2.2 Замкнутый цикл «сессия → метрики → прогресс»

Сейчас два параллельных мира: live (игра + давление) и аналитика (CEMRR CSV + mock history).

| Задача | Детали |
| ------ | ------ |
| Session log | При каждой сессии: hits/misses, lane, timestamps, pressure peaks, cadence, symmetry, treadmill speed. |
| Хранение | SQLite или JSON; API в FastAPI backend. |
| Progress dashboard | Подключить `ProgressDashboard` к реальным сессиям вместо mock в `progressAnalytics.ts`. |
| CEMRR | Связать offline CEMRR с данными insole/exoskeleton A-GEAR, где доступны. |
| Экспорт | PDF/CSV для врача после сеанса. |

**Цель:** игра становится инструментом документирования реабилитации, а не развлечением на дорожке.

---

### 2.3 Адаптивная терапия (personalization)

| Задача | Детали |
| ------ | ------ |
| Профиль ребёнка | Baseline симметрия, допустимый DSR, целевой cadence, порог давления. |
| Автоподстройка сложности | N попаданий подряд → чуть быстрее; серия промахов → медленнее, шире плитки. |
| Режимы тренировки | «Ритм», «симметрия», «выносливость», «координация с экзоскелетом». |
| Подсказки терапевту | Рекомендации на live-метриках: снизить `--insole-thresh-kpa`, увеличить `--step-time-s` и т.п. |

**Цель:** универсальная сложность не подходит для ДЦП; адаптация — ключевая клиническая ценность.

---

### 2.4 Интеграция с A-GEAR / экзоскелетом

Gressus — модуль обратной связи внутри **A-GEAR** (gait exoskeleton-assisted rehabilitation).

| Задача | Детали |
| ------ | ------ |
| Синхронизация фаз | Крутящий момент / фаза шага экзоскелета ↔ hit gate и feedback. |
| Клинический сигнал | Не только «попал/не попал», но «нагрузка на нужную ногу в нужную фазу». |
| Единый протокол | Patient ID, session metadata между controller экзоскелета и Gressus backend. |

**Цель:** отличие от «projector + depth camera» — часть медицинского комплекса.

---

### 2.5 Продуктовая упаковка для клиники

| Задача | Детали |
| ------ | ------ |
| One-click launch | systemd unit, docker-compose или desktop wrapper вместо двух терминалов. |
| Режимы установки | «Только insole», «только projection», «full stack». |
| Self-diagnosis | Журнал ошибок и проверки для биомедика, не для разработчика. |
| Offline-first | Сессия не падает из-за сети; локальное хранение логов. |

**Цель:** следующий пользователь — реабилитолог, не программист.

---

### 2.6 Клиническая и научная линия

| Задача | Детали |
| ------ | ------ |
| Протокол пилота | N детей, baseline vs после N сессий; primary outcome: symmetry, cadence, GMFCS-релевантные метрики. |
| Ablation сенсоров | Сравнение `D+R+P` vs `D+P` vs только insole — обоснование multimodal fusion. |
| Регуляторика | При цели медизделия — траектория SaMD / локальная регистрация ПО. |

**Цель:** публикация, гранты, внедрение в клиниках NU / партнёров.

---

### 2.7 Контент и мотивация (вторичный приоритет)

| Задача | Детали |
| ------ | ------ |
| Новые сценарии на одном движке | Следы, мост, сбор урожая — та же hit-логика, другой визуал. |
| i18n | Расширение kk / ru / en в `frontend/src/i18n/translations.ts`. |
| Долгосрочная прогрессия | Patient view привязать к реальным метрикам сессий, не mock score. |

---

## 3) Рекомендуемый порядок (3–6 месяцев)

| Этап | Фокус | Результат |
| ---- | ----- | --------- |
| **Q1** | Стабильность depth + wizard калибровки | Сессия без ручной отладки |
| **Q2** | Session logging + real progress dashboard | Клинически полезный отчёт после каждого сеанса |
| **Q3** | Adaptive difficulty + A-GEAR hooks | Связка с экзоскелетом |
| **Q4** | Пилот + упаковка для клиники | Готовность к внедрению |

---

## 4) Open items (связь с system-spec)

Перенос и актуализация пунктов из [system-spec.md §5](system-spec.md):

- [done] `station/tools/realsense_depth_preview.py` — debug depth/color, FPS, USB.
- [done] Depth-сегментация в `station/runners/tile_game.py` (D gate); RGB остаётся R gate.
- [in progress] `station/tools/realsense_floor_debug.py` — floor model → depth mask.
- [ ] Проверить фактические лимиты Frbby P40 Pro (zoom, lens shift, keystone) на стенде.
- [ ] Session log API и интеграция с frontend progress.
- [ ] Wizard калибровки в web Control.
- [ ] Health-check endpoint при старте runtime.
