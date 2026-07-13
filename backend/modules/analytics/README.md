# Analytics — CEMRR gait metrics

Справочник для инженера робототехники: что считает `calculator.py`, откуда берутся данные,
какие поля ждёт код и чего **нет** в UDP-телеметрии P.GEAR.

Источник формул: `CEMRR_GAIT_10Cycle_HandCalc.docx` (CEMRR, Nazarbayev University).
Код: `calculator.py`, импорт rosbag: `processor.py`.

---

## Контекст за 2 минуты

Пациент идёт в экзоскелете на дорожке. Во время сессии пишется **поток строк** (time series):
каждая строка — снимок всех датчиков в один момент времени. После сессии `calculator.py`:

1. Находит **эпизоды походки** (`phase == "GAIT"` и `running == 1`).
2. Считает метрики на эпизод.
3. Агрегирует в отчёт сессии.

Документ профессора описывает **три физических источника**:

| Источник | Что измеряет | Аналог в железе |
|----------|--------------|-----------------|
| **Энкодеры** (4 оси) | угол и скорость сустава | ODrive → `pos`, `vel` в UDP |
| **Load cell** (4 шт., в доке «Futek®») | сила/момент на оси | coproc → `measTorque` в UDP (уже **Nm**, не N) |
| **Инсоли** (2×16 датчиков) | HS/TO, распределение давления | **отдельный стек**, в UDP **нет** |

UDP LogPacket (pgear-нода, 100 Гц) — это **только экзоскелет**. Без инсолей полный CEMRR/GRI
из документа **недостижим**; код использует оценки и дефолтные константы.

---

## Входные данные

### 1. Строки сессии (`rows`)

Список dict, отсортированный по времени. Время: `session_t_s`, `t_s` или `_mcap_log_time_ns`.

Сейчас `processor.py` читает **JSON из MCAP**; маппинг из `PgearTelemetry` в эти ключи
**ещё должен делать recorder** (см. таблицу ниже).

### 2. Параметры сессии (`parameters`)

Берутся из `Session.exo_profile.analytics` (или корня профиля). Если нет — **дефолты**
из `DEFAULT_PARAMETERS` в `calculator.py` (значения из docx для примера пациента 32 кг).

| Параметр | Дефолт | В UDP? | Смысл |
|----------|--------|--------|-------|
| `leg_length_m` | 0.62 m | нет | длина ноги для кинематики шага |
| `belt_speed_m_s` | 0.50 m/s | нет | скорость ленты дорожки |
| `moment_arm_m` | 0.25 m | нет | плечо момента load cell |
| `passive_force_n` | 5.1 / 4.6 / 4.0 / 3.7 N | нет | калибровка «пассивного» пациента |
| `normal.*` | cadence 110, belt 0.9, stride 1.4 m, DSR 20% | нет | «здоровая» норма для E |
| `baseline.*` | SI 20.54%, CV 4.2%, DSR 36% | нет | первая сессия пациента для S, V, B |
| `weights` | 0.25/0.15/0.20/0.20/0.20 | нет | веса GRI |

Ответ API содержит `missingParameters` и `defaultedParameters` — что не задано в профиле.

### 3. Маппинг UDP → поля строки

| Поле строки | UDP / P.GEAR | Примечание |
|-------------|--------------|------------|
| `HR_deg`, `HL_deg`, `KR_deg`, `KL_deg` | `pos` | motor turns → ° (нужен `TURNS_PER_DEG` и знак сустава) |
| `*_ref_deg` | `refPos` | то же |
| `*_vel` | `vel` | turns/s → °/s |
| `*_meas_nm` | `measTorque` | Nm, load cell |
| `*_cmd_nm` | `cmdTorque` | Nm |
| `phase` | `gaitPhase` | IDLE / GAIT / … |
| `running` | `flags` bit 0 | |
| `step_idx` | `stepIdx` | фаза траектории 0–49, **не** heel strike |
| `assist_r`, `assist_l` | `assistR`, `assistL` | |
| `estop`, `sensor_online` | `flags` | |
| `torque_mode` | `flags` bit 9 | |
| `link_age_ms`, `ctrl_loop_us` | `linkAgeMs`, `ctrlLoopUs` | |
| `cross_check`, `hb_error` | `crossCheckFault`, `hbErrorByte` | |
| `F_hip_L` … `F_knee_R` | — | **нет**; нужны N или `τ/moment_arm` |
| `*_patient_nm`, `*_patient_status` | — | **нет**; baseline pipeline на PC |
| `HS_L`, `HS_R`, `TO_L`, `TO_R` | — | **инсоли** |
| `aan_factor`, `aan_driving` | — | в UDP только флаг AAN, не полная телеметрия |

---

## Группы метрик

### A. Временá походки (Timing)

**Смысл:** ритм и фазы стопы — сколько длится шаг, стойка, перенос, двойная опора.
Клинически важны для симметрии и устойчивости.

**Нужны:** события HS (heel strike) и TO (toe-off) **левой и правой** ноги.

| Метрика | Формула (LaTeX) | Поля строк | Статус без инсолей |
|---------|-----------------|------------|-------------------|
| Stride time L/R | \(t^{stride}_L(i) = HS_L(i+1) - HS_L(i)\) | `HS_L`, `HS_R` | fallback: события из `step_idx == 0` |
| Stance time | \(t^{stance}_L(i) = TO_L(i) - HS_L(i)\) | `TO_L` | fallback: TO ≈ HS + 62.2% stride (L), 57.4% (R) |
| Swing time | \(t^{swing}_L(i) = HS_L(i+1) - TO_L(i)\) | | то же |
| Double support | \(t_{ds}(i) = \min(TO_L, TO_R) - \max(HS_L, HS_R)\) | все HS/TO | оценка неточная |
| Cadence | \(\text{Cadence} = 60 / \overline{\Delta t_{step}}\) | HS обеих ног | грубая оценка |
| Stride time CV | \(CV = \sigma / \mu \times 100\%\) | серии stride | зависит от качества HS |
| Stride time SI | \(SI = \lvert \mu_L - \mu_R \rvert / \frac{\mu_L + \mu_R}{2} \times 100\%\) | | считается |
| DSR | \(DSR = \overline{t_{ds}} / \overline{t^{stride}_L} \times 100\%\) | | зависит от TO |

**Реализация:** `_timing_metrics()` — **есть**.

**Без инсолей:** `eventSource = "step_idx_zero_crossings_estimated"`, TO синтетические.
Метрики **S, V, B** и cadence/DSR **клинически ненадёжны**.

---

### B. Пространственные метрики (Spatial / Step length)

**Смысл:** насколько далеко пациент «шагает» — длина шага и цикла. На дорожке
длина = кинематика бедра + вклад движущейся ленты.

| Метрика | Формула | Данные | Параметры (дефолт если нет в UDP) |
|---------|---------|--------|-----------------------------------|
| Kinematic step | \(L_{kin} = 2 L_{leg} \sin(\theta_{hip,max} / 2)\) | `HL_deg` / `HR_deg` пик за цикл | `leg_length_m` = 0.62 m |
| Belt contribution | \(L_{belt} = v_{belt} \cdot t_{step}\) | HS-тайминги | `belt_speed_m_s` = 0.50 m/s |
| Step length | \(L_{step} = L_{kin} + L_{belt}\) | | |
| Stride length | \(L_{stride} = L_{step,L} + L_{step,R}\) | | |
| Step length SI | \(SI = \lvert \mu_{L} - \mu_{R} \rvert / \frac{\mu_L + \mu_R}{2} \times 100\%\) | | |

**Реализация:** `_step_length_metrics()` — **есть**.

**Зависимость от дефолтов:** `leg_length_m`, `belt_speed_m_s` не приходят по UDP.
Тайминги шага — от инсолей или fallback.

---

### C. Момент и сила пациента (Torque / STR)

**Смысл:** load cell в серии с приводом измеряет, сколько усилия даёт **пациент** vs
«пассивная» калибровка (расслаблен на пустом exo). PTF — доля вклада пациента → **STR** в GRI.

| Метрика | Формула | Данные | Параметры (дефолт) |
|---------|---------|--------|-------------------|
| Session force | \(F_{session}\) — пик/среднее за цикл | `F_hip_L` … `F_knee_R` (N) | или `*_patient_nm` |
| Human torque | \(\tau_{human} = (F_{passive} - F_{session}) \cdot r_{arm}\) | | `passive_force_n`, `moment_arm_m` = 0.25 m |
| PTF | \(PTF = (F_{passive} - \overline{F_{session}}) / F_{passive}\) | | дефолт F_passive из docx |
| STR | \(STR = \text{mean}(PTF_{Lhip}, PTF_{Rhip}, PTF_{Lknee}, PTF_{Rknee})\) | | |

**Реализация:** `_torque_metrics()` — **есть**.

**UDP:** есть `measTorque` (Nm), **нет** \(F\) в ньютонах. Можно \(F \approx \tau / r_{arm}\),
если задать `moment_arm_m`. **`passive_force_n`** — калибровка, в UDP нет → **дефолт docx**.

**`*_patient_nm`:** в UDP нет; нужен baseline (iq или load cell) на PC, как в `pgear_pi` worker.

---

### D. Аспекты CEMRR и GRI

**Смысл:** пять нормированных оценок [0…1], свёртка — **Gait Recovery Index**.
0 = как на baseline-сессии, 1 = уровень «нормального» референса.

| Аспект | Что отражает | Формула нормализации | Нужные метрики | Baseline / Normal (дефолт) |
|--------|--------------|----------------------|----------------|----------------------------|
| **S** Symmetry | симметрия длины шага | \(S = 1 - SI_{step} / SI_{baseline}\) | Step length SI | baseline SI = 20.54% |
| **V** Stability | стабильность ритма | \(V = 1 - \overline{CV} / CV_{baseline}\) | Stride time CV | baseline CV = 4.2% |
| **B** Support | двойная опора / баланс | \(B = 1 - \frac{DSR - DSR_{norm}}{DSR_{base} - DSR_{norm}}\) | DSR | norm 20%, base 36% |
| **E** Efficiency | скорость, каденс, длина цикла | mean of ratios to normal | cadence, stride, belt | norm: 110 spm, 1.4 m, 0.9 m/s |
| **STR** Strength | мышечный вклад | из PTF (раздел C) | load cell + passive cal | `passive_force_n` |

**GRI:**

\[
GRI = 0.25\,S + 0.15\,V + 0.20\,B + 0.20\,E + 0.20\,STR
\]

**Реализация:** `_aspect_scores()`, `_weighted_gri()` — **есть**.

**С дефолтами:** все `baseline`, `normal`, `weights`, `passive_force_n` — из docx, если
не заданы в `exo_profile.analytics`.

---

### E. Кинематика экзоскелета (Kinematics)

**Смысл:** насколько сустав **двигается** относительно референса траектории — ROM, скорости.

| Метрика | Формула | Поля строк |
|---------|---------|------------|
| ROM | \(ROM_J = \max(\theta_J) - \min(\theta_J)\) | `HR_deg` … `KL_deg` |
| Reference ROM | \(ROM_{ref,J} = \max(\theta_{ref}) - \min(\theta_{ref})\) | `*_ref_deg` |
| Active ROM ratio | \(ROM_J / ROM_{ref,J}\) (clamp 0…1.5) | |
| Peak flexion / extension | \(\max\), \(\min\) угла | |
| Mean / peak velocity | \(\overline{\lvert \dot\theta \rvert}\), \(\max\lvert \dot\theta \rvert\) | `*_vel` |

**Реализация:** `_exoskeleton_joint_metrics()` → `kinematics` — **есть**.

**UDP:** `pos`, `vel`, `refPos` — **достаточно** (после конвертации в градусы).

---

### F. Трекинг траектории (Tracking)

**Смысл:** насколько реальный угол следует заданной траектории контроллера.

| Метрика | Формула |
|---------|---------|
| Error | \(e_J(t) = \theta_{ref,J}(t) - \theta_J(t)\) |
| MAE | \(MAE_J = \overline{\lvert e_J \rvert}\) |
| RMSE | \(RMSE_J = \sqrt{\overline{e_J^2}}\) |
| Compliance | \(\text{clamp}(1 - RMSE_J / ROM_{ref,J},\, 0,\, 1)\) |

**Реализация:** **есть** (`tracking` в session aggregate).

**UDP:** `pos` + `refPos` — **достаточно**.

---

### G. Момент привода и участие (Robot / Patient torque)

**Смысл:** усилие мотора vs оценка вклада пациента (если посчитан `patient_nm`).

| Метрика | Формула |
|---------|---------|
| Robot torque mean/RMS/peak | по `*_meas_nm` |
| Torque tracking RMSE | \(RMSE(\tau_{cmd} - \tau_{meas})\) |
| Patient torque | \(\overline{\lvert \tau_{patient} \rvert}\) при `*_patient_status == ok` |
| Participation | \(\overline{\lvert \tau_p \rvert} / (\overline{\lvert \tau_p \rvert} + \overline{\lvert \tau_{robot} \rvert})\) |

**Реализация:** **есть**.

**UDP:** `measTorque`, `cmdTorque` — **да**. `*_patient_nm` — **нет** → participation часто пустая.

---

### H. Механическая мощность и работа (Power / Work)

\[
P_J(t) = \tau_J(t) \cdot \dot\theta_J(t), \quad W = \sum P \cdot \Delta t
\]

Отдельно positive / negative work.

**Реализация:** **есть** (`power`).

**UDP:** `measTorque` + `vel` — **да** для robot; patient — только если есть `patient_nm`.

---

### I. Помощь экзоскелета (Assistance)

| Метрика | Поля |
|---------|------|
| Assist mean | `assist_r`, `assist_l` |
| AAN driving % | `aan_driving > 0` |
| Torque mode % | `torque_mode == 1` |

**Реализация:** **есть**.

**UDP:** `assistR/L` — **да**. `aan_driving`, `aan_factor` — **нет** (только бит AAN в flags).

---

### J. Симметрия экзоскелета (не из docx CEMRR, расширение кода)

ROM SI и patient-torque SI между L/R бедро и колено.

**Реализация:** `_exoskeleton_symmetry()` — **есть**.

---

### K. Безопасность и надёжность (Safety)

E-stop, heartbeat errors, cross-check, link age, control loop jitter, % валидных сэмплов.

**Реализация:** `_safety_metrics()` — **есть**.

**UDP:** **всё есть** в пакете (flags, `linkAgeMs`, `ctrlLoopUs`, fault bytes).

---

### L. Средний цикл походки (Average gait cycle)

Нормализация времени цикла в фазу 0…100%, интерполяция ref/actual, среднее по циклам.

**Реализация:** `_average_gait_cycle_profiles()` — **есть**.

**События цикла:** предпочтительно `HS_L`/`HS_R` (инсоли), иначе `step_idx` crossings.

---

### M. Усталость (Fatigue trends)

Наклон метрик по 60-секундам окнам (ROM, RMSE, torques, participation).

**Реализация:** `_fatigue_trends()` — **есть**. Эвристические метки `possible_fatigue`.

---

### N. Session score (exo, не GRI)

\[
Score = 0.25\,Tracking + 0.20\,Motion + 0.25\,Participation + 0.15\,Symmetry + 0.15\,Reliability
\]

**Реализация:** `_exoskeleton_scores()` — **есть**.

---

## Метрики из docx, которых **нет** в `calculator.py`

| Из документа | Раздел docx | Статус |
|--------------|-------------|--------|
| Среднее давление **L1–L16, R1–R16** (% body weight) | §1.4 | **Не реализовано** |
| Алгоритм HS по пяткам (сенсоры 13–16, порог 5%) | §1.2 | **Не в analytics** — ожидаются готовые `HS_*`/`TO_*` в строках |
| `patient_torque` через iq-baseline (альтернатива load cell) | §2.7 / pi_gui | **Не в analytics** — нужен отдельный pipeline → `*_patient_nm` |

---

## Сводка: что можно считать **только из UDP** (после маппинга в строки)

| Группа | UDP достаточно? |
|--------|-----------------|
| E. Kinematics | да |
| F. Tracking | да |
| G. Robot torque | да |
| G. Patient / Participation | **нет** (`patient_nm`) |
| H. Power (robot) | да |
| I. Assistance (частично) | assist да; AAN detail нет |
| J, K, L (частично), M, N | да / частично |
| A. Timing | **нет** (нужны инсоли или грубый fallback) |
| B. Spatial | **нет** (нужны HS + дефолт `leg_length`, `belt_speed`) |
| C. Torque STR | **нет** (нужны `F_*` или calib + `passive_force_n` дефолт) |
| D. GRI | **нет** (зависит от A–C + baseline/normal дефолты) |

---

## Параметры, всегда требующие профиля / калибровки (не в UDP)

Эти величины **никогда** не приходят в LogPacket; без записи в `exo_profile.analytics`
используются дефолты из docx:

- `leg_length_m`, `belt_speed_m_s`, `moment_arm_m`
- `passive_force_n` (4 сустава)
- `baseline.*` (для нормализации S, V, B)
- `normal.*` (для E)
- `weights` (для GRI)

Проверка: `calculate_session_metrics(...).["missingParameters"]` и `["defaultedParameters"]`.

---

## Поток обработки

```
rosbag (MCAP JSON rows)
    → find_episodes()          # GAIT + running
    → calculate_episode_metrics()
        → timing, spatial, torque, aspect scores (CEMRR)
    → aggregate_episode_metrics()
        → exoskeleton session metrics + cemrrScores + GRI
```

См. также: `docs/PACKET_STRUCTURE.md` (UDP), `processor.py` (импорт), `FORMULAS` в `calculator.py` (машиночитаемый реестр формул).

---

## Рекомендации для полного CEMRR

1. **Инсоли** → `HS_L`, `HS_R`, `TO_L`, `TO_R` в строках (200 Hz, синхронизация по времени).
2. **Калибровка** → записать `passive_force_n` и baseline после первой сессии в `exo_profile.analytics`.
3. **Patient torque** → baseline pipeline → `HR_patient_nm` и т.д.
4. **Recorder** → публиковать единый JSON-ряд: exo (из UDP) + insole events + опционально давления.
5. **Параметры дорожки** → `belt_speed_m_s`, `leg_length_m` в профиле сессии, не дефолт docx.
