"""Kazakh voice UI phrases for the projector tile / piano game.

Files live in ``assets/ui_phrases/``. Names encode meaning; variants in a group
are played in round-robin order.
"""

from __future__ import annotations

from pathlib import Path
from typing import Literal

PhraseCategory = Literal[
    "positive",
    "correction",
    "motivation",
    "intro_start",
    "intro_end",
]

# Interchangeable variants per category (Kazakh voice prompts).
PHRASE_GROUPS: dict[PhraseCategory, tuple[str, ...]] = {
    "positive": (
        "positive_01_jaraysyn.wav",
        "positive_02_ote_zhaqsy.wav",
        "positive_03_keremet.wav",
        "positive_04_tamasha_jumys.wav",
        "positive_05_myqty_qadam.wav",
    ),
    "correction": (
        "correction_01_abai_bol.wav",
        "correction_02_qaitadan_baiqap_kor.wav",
        "correction_03_kelesi_plitkaga_nazar.wav",
        "correction_04_qolyngnan_keledi.wav",
    ),
    "motivation": (
        "motivation_01_bonus_upai.wav",
        "motivation_02_zhana_rekord.wav",
        "motivation_03_sen_keremetsin.wav",
    ),
    "intro_start": (
        "intro_01_jattygu_uakyty_keldi.wav",
        "intro_02_bastayyk.wav",
    ),
    "intro_end": ("intro_03_seans_ayaqtaldy.wav",),
}

UI_PHRASES_SUBDIR = "ui_phrases"


class PhraseRotator:
    """Round-robin picker within each phrase category."""

    def __init__(self) -> None:
        self._idx: dict[PhraseCategory, int] = dict.fromkeys(PHRASE_GROUPS, 0)

    def next_filename(self, category: PhraseCategory) -> str:
        files = PHRASE_GROUPS[category]
        i = self._idx[category]
        self._idx[category] = (i + 1) % len(files)
        return files[i]


def default_phrases_dir(assets_dir: Path) -> Path:
    return assets_dir.resolve() / UI_PHRASES_SUBDIR
