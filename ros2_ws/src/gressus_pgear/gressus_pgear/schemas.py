"""Pydantic DTOs for LogPacket_v2 (206-byte UDP broadcast, little-endian)."""

from __future__ import annotations

from typing import Annotated, Self

from pydantic import BaseModel, ConfigDict, Field, model_validator

from gressus_pgear.constants import (
    CURRENT_PACKET_VERSION,
    HEARTBEAT_NEVER_RECEIVED,
    LOG_PACKET_MAGIC,
    LOG_PACKET_SIZE,
    PROFILE_SLOT_NONE,
)
from gressus_pgear.enums import GaitPhase, JointIndex

_JOINT_R_HIP = "Правый тазобедренный сустав (R-hip)."
_JOINT_R_KNEE = "Правый коленный сустав (R-knee)."
_JOINT_L_HIP = "Левый тазобедренный сустав (L-hip)."
_JOINT_L_KNEE = "Левый коленный сустав (L-knee)."


class LogPacketHeader(BaseModel):
    """Заголовок пакета (байты 0–7): синхронизация, версия протокола, номер кадра."""

    model_config = ConfigDict(frozen=True)

    start0: Annotated[
        int,
        Field(ge=0, le=255, description="Первый байт magic-сигнатуры; всегда 0xBB."),
    ]
    start1: Annotated[
        int,
        Field(ge=0, le=255, description="Второй байт magic-сигнатуры; всегда 0x66."),
    ]
    version: Annotated[
        int,
        Field(ge=0, le=255, description="Версия wire-формата пакета; актуальная — 3."),
    ]
    reserved0: Annotated[
        int,
        Field(ge=0, le=255, description="Зарезервировано прошивкой; должно быть 0."),
    ] = 0
    seq: Annotated[
        int,
        Field(ge=0, le=65535, description="Монотонный счётчик пакетов с момента старта трансляции."),
    ]
    header_crc: Annotated[
        int,
        Field(
            ge=0,
            le=65535,
            description="CRC-16 первых 6 байт заголовка; быстрая проверка целостности и версии.",
        ),
    ]

    @model_validator(mode="after")
    def _check_magic(self) -> Self:
        if (self.start0, self.start1) != LOG_PACKET_MAGIC:
            msg = f"invalid magic: ({self.start0:#x}, {self.start1:#x})"
            raise ValueError(msg)
        return self


class TimingBlock(BaseModel):
    """Метка времени прошивки (байты 8–11)."""

    model_config = ConfigDict(frozen=True)

    time_ms: Annotated[
        int,
        Field(
            ge=0,
            description="Время сборки пакета по `millis()` контроллера, мс от старта/перезагрузки.",
        ),
    ]


class SensorHealth(BaseModel):
    """Битовая маска `sensorHealth`: связь с датчиками каждого привода по UART."""

    model_config = ConfigDict(frozen=True)

    r_hip: Annotated[
        bool,
        Field(description=f"{_JOINT_R_HIP} Бит 0: 1 = последний UART-кадр принят успешно."),
    ] = False
    r_knee: Annotated[
        bool,
        Field(description=f"{_JOINT_R_KNEE} Бит 1: 1 = последний UART-кадр принят успешно."),
    ] = False
    l_hip: Annotated[
        bool,
        Field(description=f"{_JOINT_L_HIP} Бит 2: 1 = последний UART-кадр принят успешно."),
    ] = False
    l_knee: Annotated[
        bool,
        Field(description=f"{_JOINT_L_KNEE} Бит 3: 1 = последний UART-кадр принят успешно."),
    ] = False

    @classmethod
    def from_mask(cls, mask: int) -> Self:
        return cls(
            r_hip=bool(mask & (1 << JointIndex.R_HIP)),
            r_knee=bool(mask & (1 << JointIndex.R_KNEE)),
            l_hip=bool(mask & (1 << JointIndex.L_HIP)),
            l_knee=bool(mask & (1 << JointIndex.L_KNEE)),
        )

    def to_mask(self) -> int:
        mask = 0
        if self.r_hip:
            mask |= 1 << JointIndex.R_HIP
        if self.r_knee:
            mask |= 1 << JointIndex.R_KNEE
        if self.l_hip:
            mask |= 1 << JointIndex.L_HIP
        if self.l_knee:
            mask |= 1 << JointIndex.L_KNEE
        return mask


class LogPacketFlags(BaseModel):
    """Флаги верхнего уровня контроллера походки (`flags`, uint16)."""

    model_config = ConfigDict(frozen=True)

    run_flag: Annotated[
        bool,
        Field(description="Бит 0: экзоскелет в рабочем режиме (движение/ассист разрешён)."),
    ] = False
    emergency_stop: Annotated[
        bool,
        Field(description="Бит 1: аварийная остановка (E-stop); приводы должны снять момент."),
    ] = False
    sensor_link_online: Annotated[
        bool,
        Field(description="Бит 2: канал связи с сенсорным UART активен и в рабочем состоянии."),
    ] = False
    ff_enabled: Annotated[
        bool,
        Field(description="Бит 3: включена feedforward-компенсация (упреждающий момент по модели)."),
    ] = False
    fuzzy_enabled: Annotated[
        bool,
        Field(description="Бит 4: включён нечёткий (fuzzy) регулятор ассиста."),
    ] = False
    ffp_tripped: Annotated[
        bool,
        Field(
            description=(
                "Бит 5: сработал монитор пассивности FF (feedforward passivity monitor) — "
                "контроллер ограничил активную помощь."
            ),
        ),
    ] = False
    segment_grav_model: Annotated[
        bool,
        Field(description="Бит 6: используется сегментная модель гравитационной компенсации конечностей."),
    ] = False
    any_cross_check_fault: Annotated[
        bool,
        Field(
            description=(
                "Бит 7: хотя бы на одной оси зафиксирован cross-check fault "
                "(расхождение измеренного и ожидаемого момента/тока)."
            ),
        ),
    ] = False
    gait_auto_progress: Annotated[
        bool,
        Field(description="Бит 8: походка автоматически переключает фазы/шаги без ручного триггера."),
    ] = False
    torque_mode: Annotated[
        bool,
        Field(
            description=(
                "Бит 9: режим управления — True = момент (torque), "
                "False = позиция (position/trajectory tracking)."
            ),
        ),
    ] = False

    @classmethod
    def from_mask(cls, mask: int) -> Self:
        return cls(
            run_flag=bool(mask & (1 << 0)),
            emergency_stop=bool(mask & (1 << 1)),
            sensor_link_online=bool(mask & (1 << 2)),
            ff_enabled=bool(mask & (1 << 3)),
            fuzzy_enabled=bool(mask & (1 << 4)),
            ffp_tripped=bool(mask & (1 << 5)),
            segment_grav_model=bool(mask & (1 << 6)),
            any_cross_check_fault=bool(mask & (1 << 7)),
            gait_auto_progress=bool(mask & (1 << 8)),
            torque_mode=bool(mask & (1 << 9)),
        )

    def to_mask(self) -> int:
        mask = 0
        if self.run_flag:
            mask |= 1 << 0
        if self.emergency_stop:
            mask |= 1 << 1
        if self.sensor_link_online:
            mask |= 1 << 2
        if self.ff_enabled:
            mask |= 1 << 3
        if self.fuzzy_enabled:
            mask |= 1 << 4
        if self.ffp_tripped:
            mask |= 1 << 5
        if self.segment_grav_model:
            mask |= 1 << 6
        if self.any_cross_check_fault:
            mask |= 1 << 7
        if self.gait_auto_progress:
            mask |= 1 << 8
        if self.torque_mode:
            mask |= 1 << 9
        return mask


class GaitState(BaseModel):
    """Состояние конечного автомата походки (байты 12–19)."""

    model_config = ConfigDict(frozen=True)

    gait_phase: Annotated[
        int,
        Field(
            ge=0,
            le=255,
            description=(
                "Фаза походки (PH_IDLE=0, PH_GAIT, PH_RAMP_DOWN и др.). "
                "Определяет, какой сценарий движения сейчас выполняет контроллер."
            ),
        ),
    ]
    step_idx: Annotated[
        int,
        Field(
            ge=0,
            le=49,
            description="Индекс текущей точки в 50-точечной референсной траектории шага (0–49).",
        ),
    ]
    profile_slot: Annotated[
        int,
        Field(
            ge=0,
            le=255,
            description=(
                "Номер NVS-слота активного профиля походки (0–7); 0xFF = профиль не выбран."
            ),
        ),
    ]
    sensor_health: Annotated[
        SensorHealth,
        Field(description="Состояние UART-связи с датчиками каждого из четырёх приводов."),
    ]
    flags: Annotated[
        LogPacketFlags,
        Field(description="Системные флаги контроллера: режим, E-stop, FF, cross-check и т.д."),
    ]
    link_age_ms: Annotated[
        int,
        Field(
            ge=0,
            le=65535,
            description=(
                "Сколько миллисекунд прошло с последнего корректного UART-кадра от сенсорного звена; "
                "растёт при потере связи (макс. 65535)."
            ),
        ),
    ]

    @property
    def gait_phase_enum(self) -> GaitPhase | None:
        try:
            return GaitPhase(self.gait_phase)
        except ValueError:
            return None

    @property
    def profile_active(self) -> bool:
        return self.profile_slot != PROFILE_SLOT_NONE


class JointFloats(BaseModel):
    """Четыре значения по суставам: R-hip, R-knee, L-hip, L-knee (порядок прошивки)."""

    model_config = ConfigDict(frozen=True)

    r_hip: Annotated[float, Field(description=_JOINT_R_HIP)]
    r_knee: Annotated[float, Field(description=_JOINT_R_KNEE)]
    l_hip: Annotated[float, Field(description=_JOINT_L_HIP)]
    l_knee: Annotated[float, Field(description=_JOINT_L_KNEE)]

    @classmethod
    def from_tuple(cls, values: tuple[float, float, float, float]) -> Self:
        return cls(
            r_hip=values[JointIndex.R_HIP],
            r_knee=values[JointIndex.R_KNEE],
            l_hip=values[JointIndex.L_HIP],
            l_knee=values[JointIndex.L_KNEE],
        )

    def as_tuple(self) -> tuple[float, float, float, float]:
        return (self.r_hip, self.r_knee, self.l_hip, self.l_knee)


class JointHeartbeatAges(BaseModel):
    """Возраст последнего heartbeat ODrive по каждой оси (`hbAgeMs`)."""

    model_config = ConfigDict(frozen=True)

    r_hip: Annotated[
        int,
        Field(ge=0, le=65535, description=f"{_JOINT_R_HIP} мс с последнего heartbeat; 65535 = не было."),
    ]
    r_knee: Annotated[
        int,
        Field(ge=0, le=65535, description=f"{_JOINT_R_KNEE} мс с последнего heartbeat; 65535 = не было."),
    ]
    l_hip: Annotated[
        int,
        Field(ge=0, le=65535, description=f"{_JOINT_L_HIP} мс с последнего heartbeat; 65535 = не было."),
    ]
    l_knee: Annotated[
        int,
        Field(ge=0, le=65535, description=f"{_JOINT_L_KNEE} мс с последнего heartbeat; 65535 = не было."),
    ]

    @classmethod
    def from_tuple(cls, values: tuple[int, int, int, int]) -> Self:
        return cls(
            r_hip=values[JointIndex.R_HIP],
            r_knee=values[JointIndex.R_KNEE],
            l_hip=values[JointIndex.L_HIP],
            l_knee=values[JointIndex.L_KNEE],
        )

    def never_received(self, joint: JointIndex) -> bool:
        ages = self.as_tuple()
        return ages[joint] == HEARTBEAT_NEVER_RECEIVED

    def as_tuple(self) -> tuple[int, int, int, int]:
        return (self.r_hip, self.r_knee, self.l_hip, self.l_knee)


class JointArrays(BaseModel):
    """Кинематика и усилия по четырём осям (байты 20–171)."""

    model_config = ConfigDict(frozen=True)

    ref_pos: Annotated[
        JointFloats,
        Field(
            description=(
                "Заданная позиция по траектории шага для каждого сустава, turns "
                "(обороты вала мотора; 1 turn ≈ один полный оборот вала)."
            ),
        ),
    ]
    pos: Annotated[
        JointFloats,
        Field(
            description="Фактическая позиция с энкодера ODrive, turns — где сустав находится сейчас.",
        ),
    ]
    vel: Annotated[
        JointFloats,
        Field(
            description="Фактическая угловая скорость сустава, turns/s — скорость изменения позиции.",
        ),
    ]
    cmd_torque: Annotated[
        JointFloats,
        Field(
            description=(
                "Командный момент на мотор после rate-limit и clamp, Nm. "
                "В position mode обычно 0; в torque mode — активная помощь/сопротивление."
            ),
        ),
    ]
    meas_torque: Annotated[
        JointFloats,
        Field(
            description=(
                "Измеренный момент с тензодатчика LCM300 на суставе, Nm — "
                "реальная механическая нагрузка/ассист."
            ),
        ),
    ]
    grav_term: Annotated[
        JointFloats,
        Field(
            description=(
                "Вклад гравитационной компенсации в команду момента за этот цикл, Nm — "
                "сколько момента ушло на «удержание» сегмента против веса."
            ),
        ),
    ]
    ff_term: Annotated[
        JointFloats,
        Field(
            description=(
                "Вклад feedforward (упреждающей модели) в команду момента за цикл, Nm — "
                "прогнозируемая нагрузка по динамике движения."
            ),
        ),
    ]
    iq_measured: Annotated[
        JointFloats,
        Field(
            description=(
                "Измеренный q-axis ток мотора, A — используется для cross-check "
                "(сравнение с measTorque/motorEffort)."
            ),
        ),
    ]
    motor_effort: Annotated[
        JointFloats,
        Field(
            description=(
                "Оценка момента по току: Iq × Kt × N × η, Nm (знак по направлению мотора) — "
                "косвенная оценка усилия привода."
            ),
        ),
    ]
    hb_age_ms: Annotated[
        JointHeartbeatAges,
        Field(description="Диагностика связи с ODrive: давность heartbeat по каждой оси."),
    ]


class TherapistTunables(BaseModel):
    """Параметры ассиста, настраиваемые терапевтом (байты 172–195)."""

    model_config = ConfigDict(frozen=True)

    assist_r: Annotated[
        float,
        Field(description="Уровень ассиста правой ноги (0–1 или масштаб усилия по прошивке)."),
    ]
    assist_l: Annotated[
        float,
        Field(description="Уровень ассиста левой ноги (0–1 или масштаб усилия по прошивке)."),
    ]
    deadzone_r: Annotated[
        float,
        Field(
            description=(
                "Мёртвая зона правой ноги, turns — минимальное отклонение от нейтрали, "
                "ниже которого ассист не включается."
            ),
        ),
    ]
    deadzone_l: Annotated[
        float,
        Field(
            description=(
                "Мёртвая зона левой ноги, turns — минимальное отклонение от нейтрали, "
                "ниже которого ассист не включается."
            ),
        ),
    ]
    amp_r: Annotated[
        float,
        Field(
            description=(
                "Амплитуда траектории правой ноги, turns — насколько далеко сустав "
                "отклоняется по референсной траектории шага."
            ),
        ),
    ]
    amp_l: Annotated[
        float,
        Field(
            description=(
                "Амплитуда траектории левой ноги, turns — насколько далеко сустав "
                "отклоняется по референсной траектории шага."
            ),
        ),
    ]


class DiagnosticsBlock(BaseModel):
    """Диагностика контроллера и шины (байты 196–203)."""

    model_config = ConfigDict(frozen=True)

    ctrl_loop_us: Annotated[
        int,
        Field(
            ge=0,
            le=65535,
            description=(
                "Время выполнения последнего цикла управления (250 Hz), µs — "
                "нагрузка на CPU; рост может означать перегруз."
            ),
        ),
    ]
    link_crc_fails: Annotated[
        int,
        Field(
            ge=0,
            le=65535,
            description="Число CRC-ошибок на сенсорном UART с момента загрузки прошивки.",
        ),
    ]
    link_resyncs: Annotated[
        int,
        Field(
            ge=0,
            le=65535,
            description="Число принудительных resync на UART с момента загрузки (потеря кадров).",
        ),
    ]
    cross_check_fault: Annotated[
        int,
        Field(
            ge=0,
            le=255,
            description=(
                "Битовая маска защёлкнутых cross-check fault: бит i = сустав i "
                "(0=R-hip … 3=L-knee) имеет расхождение момента/тока."
            ),
        ),
    ]
    hb_error_byte: Annotated[
        int,
        Field(
            ge=0,
            le=255,
            description=(
                "Битовая маска ошибок heartbeat ODrive: бит i = 1, если lastHbError != 0 "
                "на оси i."
            ),
        ),
    ]

    def cross_check_fault_active(self, joint: JointIndex) -> bool:
        return bool(self.cross_check_fault & (1 << joint))

    def hb_error_active(self, joint: JointIndex) -> bool:
        return bool(self.hb_error_byte & (1 << joint))


class LogPacketTrailer(BaseModel):
    """Контрольная сумма пакета (байты 204–205)."""

    model_config = ConfigDict(frozen=True)

    crc: Annotated[
        int,
        Field(
            ge=0,
            le=65535,
            description="CRC-16/CCITT по байтам [0..203] — полная проверка целостности кадра.",
        ),
    ]


class LogPacketV2(BaseModel):
    """Полный телеметрический кадр экзоскелета LogPacket_v2 (100 Hz, 206 байт UDP)."""

    model_config = ConfigDict(frozen=True)

    header: Annotated[
        LogPacketHeader,
        Field(description="Синхронизация, версия протокола и порядковый номер кадра."),
    ]
    timing: Annotated[
        TimingBlock,
        Field(description="Временная метка прошивки в момент сборки пакета."),
    ]
    gait: Annotated[
        GaitState,
        Field(description="Фаза походки, индекс шага, профиль и системные флаги."),
    ]
    joints: Annotated[
        JointArrays,
        Field(
            description=(
                "Кинематика (позиция/скорость) и усилия (моменты, токи) "
                "по четырём осям экзоскелета."
            ),
        ),
    ]
    tunables: Annotated[
        TherapistTunables,
        Field(description="Текущие настройки ассиста и траектории, заданные терапевтом."),
    ]
    diagnostics: Annotated[
        DiagnosticsBlock,
        Field(description="Служебные счётчики и fault-маски контроллера и шины."),
    ]
    trailer: Annotated[
        LogPacketTrailer,
        Field(description="CRC всего пакета для проверки при приёме по UDP."),
    ]

    @property
    def version(self) -> int:
        return self.header.version

    @property
    def seq(self) -> int:
        return self.header.seq

    @property
    def time_ms(self) -> int:
        return self.timing.time_ms

    @classmethod
    def is_valid_wire_size(cls, data: bytes) -> bool:
        return len(data) >= LOG_PACKET_SIZE

    @classmethod
    def looks_like_current_packet(cls, data: bytes) -> bool:
        return (
            cls.is_valid_wire_size(data)
            and data[0] == LOG_PACKET_MAGIC[0]
            and data[1] == LOG_PACKET_MAGIC[1]
            and data[2] == CURRENT_PACKET_VERSION
        )
