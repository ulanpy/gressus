from __future__ import annotations

import sys
import threading
import wave
from pathlib import Path
from typing import Protocol

import numpy as np
import pygame

from .ui_phrases import (
    PHRASE_GROUPS,
    PhraseCategory,
    PhraseRotator,
    default_phrases_dir,
)

# Default files under repo `assets/` (see assets/CREDITS.txt).
MUSIC_LOOP_FILENAME = "716637__audiocoffee__happy-music-loop1.wav"
HIT_SFX_FILENAME = "402288__lilmati__retro-coin-02.wav"

# Play Kazakh praise phrases on every Nth successful hit (3× less often than each hit).
POSITIVE_PHRASE_STRIDE = 3


def default_assets_dir() -> Path:
    return Path(__file__).resolve().parent.parent.parent / "assets"


def _clip01(x: float) -> float:
    return max(0.0, min(1.0, x))


def _pygame_mixer_usable() -> bool:
    """True if pygame was built with SDL_mixer (some distro wheels omit it)."""
    try:
        pygame.mixer.get_init()
    except NotImplementedError:
        return False
    return True


def _load_wav_stereo_f32(path: Path) -> tuple[np.ndarray, int]:
    """PCM WAV → float32 stereo in [-1, 1]."""
    with wave.open(str(path), "rb") as wf:
        sr = wf.getframerate()
        nch = wf.getnchannels()
        sw = wf.getsampwidth()
        nframes = wf.getnframes()
        raw = wf.readframes(nframes)
    if sw != 2:
        raise ValueError(f"Expected 16-bit WAV, got sample width {sw} in {path}")
    pcm = np.frombuffer(raw, dtype=np.int16)
    if nch == 2:
        data = pcm.reshape(-1, 2).astype(np.float32) * (1.0 / 32768.0)
    elif nch == 1:
        m = pcm.astype(np.float32) * (1.0 / 32768.0)
        data = np.column_stack([m, m])
    else:
        raise ValueError(f"Expected 1 or 2 channels in {path}")
    return data.astype(np.float32, copy=False), sr


def _resample_stereo_linear(data: np.ndarray, sr_in: int, sr_out: int) -> np.ndarray:
    if sr_in == sr_out or len(data) < 2:
        return data.astype(np.float32, copy=False)
    n_out = max(2, int(round(len(data) * float(sr_out) / float(sr_in))))
    x_old = np.linspace(0.0, 1.0, num=len(data), endpoint=False, dtype=np.float64)
    x_new = np.linspace(0.0, 1.0, num=n_out, endpoint=False, dtype=np.float64)
    out = np.empty((n_out, 2), dtype=np.float32)
    for ch in range(2):
        out[:, ch] = np.interp(x_new, x_old, data[:, ch].astype(np.float64)).astype(np.float32)
    return out


class _PhrasePlayback(Protocol):
    def play_phrase(self, category: PhraseCategory, *, interrupt: bool = False) -> bool: ...


class _PygamePhrasePlayer:
    def __init__(self, phrases_dir: Path, *, volume: float) -> None:
        self._rotator = PhraseRotator()
        self._sounds: dict[str, pygame.mixer.Sound] = {}
        self._channel = pygame.mixer.Channel(2)
        self._channel.set_volume(float(_clip01(volume)))
        loaded = 0
        for filenames in PHRASE_GROUPS.values():
            for fn in filenames:
                if fn in self._sounds:
                    continue
                path = phrases_dir / fn
                if path.is_file():
                    self._sounds[fn] = pygame.mixer.Sound(str(path))
                    loaded += 1
                else:
                    print(f"GameAudio: missing phrase: {path}", file=sys.stderr)
        if loaded == 0:
            print(f"GameAudio: no UI phrases in {phrases_dir}", file=sys.stderr)

    def play_phrase(self, category: PhraseCategory, *, interrupt: bool = False) -> bool:
        if self._channel.get_busy() and not interrupt:
            return False
        fn = self._rotator.next_filename(category)
        snd = self._sounds.get(fn)
        if snd is None:
            return False
        if interrupt and self._channel.get_busy():
            self._channel.stop()
        self._channel.play(snd)
        return True


class _SounddeviceVoiceQueue:
    """Mix one voice clip at a time into the PortAudio callback."""

    def __init__(self, lock: threading.Lock) -> None:
        self._lock = lock
        self._pending: list[np.ndarray] = []
        self._active: np.ndarray | None = None
        self._pos = 0

    def enqueue(self, data: np.ndarray, *, interrupt: bool) -> bool:
        with self._lock:
            if self._active is not None or self._pending:
                if not interrupt:
                    return False
                self._active = None
                self._pending.clear()
            self._active = data
            self._pos = 0
        return True

    def mix_into(self, outdata: np.ndarray) -> None:
        total = len(outdata)
        offset = 0
        with self._lock:
            while offset < total:
                if self._active is None:
                    if not self._pending:
                        return
                    self._active = self._pending.pop(0)
                    self._pos = 0
                voice = self._active
                pos = self._pos
                take = min(total - offset, len(voice) - pos)
                outdata[offset : offset + take] += voice[pos : pos + take]
                self._pos = pos + take
                offset += take
                if self._pos >= len(voice):
                    self._active = None


class _SounddevicePhrasePlayer:
    def __init__(self, phrases_dir: Path, *, volume: float, target_sr: int, lock: threading.Lock) -> None:
        self._rotator = PhraseRotator()
        self._volume = float(_clip01(volume))
        self._target_sr = target_sr
        self._voice = _SounddeviceVoiceQueue(lock)
        self._buffers: dict[str, np.ndarray] = {}
        for filenames in PHRASE_GROUPS.values():
            for fn in filenames:
                if fn in self._buffers:
                    continue
                path = phrases_dir / fn
                if not path.is_file():
                    print(f"GameAudio: missing phrase: {path}", file=sys.stderr)
                    continue
                data, sr = _load_wav_stereo_f32(path)
                if sr != target_sr:
                    data = _resample_stereo_linear(data, sr, target_sr)
                self._buffers[fn] = (data * self._volume).astype(np.float32, copy=False)

    @property
    def voice(self) -> _SounddeviceVoiceQueue:
        return self._voice

    def play_phrase(self, category: PhraseCategory, *, interrupt: bool = False) -> bool:
        fn = self._rotator.next_filename(category)
        buf = self._buffers.get(fn)
        if buf is None:
            return False
        return self._voice.enqueue(buf, interrupt=interrupt)


class _PygameGameAudio:
    def __init__(
        self,
        *,
        music_path: Path,
        hit_path: Path,
        phrases_dir: Path,
        music_volume: float,
        sfx_volume: float,
        phrase_volume: float,
        phrases_enabled: bool,
    ) -> None:
        self._hit: pygame.mixer.Sound | None = None
        self._music_started = False
        self._phrases: _PygamePhrasePlayer | None = None

        if not pygame.mixer.get_init():
            pygame.mixer.init(frequency=44100, size=-16, channels=2, buffer=4096)
        pygame.mixer.set_num_channels(8)

        if hit_path.is_file():
            self._hit = pygame.mixer.Sound(str(hit_path))
            self._hit.set_volume(float(_clip01(sfx_volume)))
        else:
            print(f"GameAudio: missing hit SFX: {hit_path}", file=sys.stderr)

        if music_path.is_file():
            pygame.mixer.music.load(str(music_path))
            pygame.mixer.music.set_volume(float(_clip01(music_volume)))
            pygame.mixer.music.play(-1)
            self._music_started = True
        else:
            print(f"GameAudio: missing music loop: {music_path}", file=sys.stderr)

        if phrases_enabled and phrases_dir.is_dir():
            self._phrases = _PygamePhrasePlayer(phrases_dir, volume=phrase_volume)

    def play_hit(self) -> None:
        if self._hit is not None:
            self._hit.play()

    def play_phrase(self, category: PhraseCategory, *, interrupt: bool = False) -> bool:
        if self._phrases is None:
            return False
        return self._phrases.play_phrase(category, interrupt=interrupt)

    def stop(self) -> None:
        if self._music_started:
            try:
                pygame.mixer.music.stop()
            except Exception:
                pass


class _SounddeviceGameAudio:
    """Loop BGM + one-shot SFX + voice phrases in one PortAudio stream."""

    def __init__(
        self,
        *,
        music_path: Path,
        hit_path: Path,
        phrases_dir: Path,
        music_volume: float,
        sfx_volume: float,
        phrase_volume: float,
        phrases_enabled: bool,
    ) -> None:
        import sounddevice as sd

        self._sd = sd
        mv = float(_clip01(music_volume))
        sv = float(_clip01(sfx_volume))
        self._lock = threading.RLock()
        self._music: np.ndarray
        self._music_i = 0
        self._hit_full: np.ndarray | None = None
        self._hit_pos: int | None = None
        self._stream: object | None = None
        self._phrases: _SounddevicePhrasePlayer | None = None

        music_buf: np.ndarray | None = None
        sr_m = 44100
        if music_path.is_file():
            music_buf, sr_m = _load_wav_stereo_f32(music_path)
            music_buf = (music_buf * mv).astype(np.float32, copy=False)
        else:
            print(f"GameAudio: missing music loop: {music_path}", file=sys.stderr)

        hit_buf: np.ndarray | None = None
        sr_h = 44100
        if hit_path.is_file():
            hit_buf, sr_h = _load_wav_stereo_f32(hit_path)
            hit_buf = (hit_buf * sv).astype(np.float32, copy=False)
        else:
            print(f"GameAudio: missing hit SFX: {hit_path}", file=sys.stderr)

        if music_buf is not None and hit_buf is not None and sr_h != sr_m:
            hit_buf = _resample_stereo_linear(hit_buf, sr_h, sr_m)

        if music_buf is not None:
            self._music = music_buf
            sr_out = sr_m
        elif hit_buf is not None:
            sr_out = sr_h
            self._music = np.zeros((1024, 2), dtype=np.float32)
        else:
            return

        self._hit_full = hit_buf
        self._sr = int(sr_out)

        if phrases_enabled and phrases_dir.is_dir():
            self._phrases = _SounddevicePhrasePlayer(
                phrases_dir,
                volume=phrase_volume,
                target_sr=self._sr,
                lock=self._lock,
            )

        def callback(outdata: np.ndarray, frames: int, _time, status) -> None:  # type: ignore[no-untyped-def]
            if status:
                pass
            ml = len(self._music)
            idx = (np.arange(frames, dtype=np.int64) + self._music_i) % ml
            outdata[:] = self._music[idx]

            with self._lock:
                if self._hit_full is not None and self._hit_pos is not None:
                    hdata = self._hit_full
                    hp = self._hit_pos
                    if hp < len(hdata):
                        take = min(frames, len(hdata) - hp)
                        outdata[:take] += hdata[hp : hp + take]
                        self._hit_pos = hp + take if hp + take < len(hdata) else None
                if self._phrases is not None:
                    self._phrases.voice.mix_into(outdata)

            np.clip(outdata, -1.0, 1.0, out=outdata)
            self._music_i = (self._music_i + frames) % ml

        self._stream = sd.OutputStream(
            samplerate=self._sr,
            channels=2,
            dtype="float32",
            blocksize=2048,
            callback=callback,
        )
        self._stream.start()

    def play_hit(self) -> None:
        if self._hit_full is None or self._stream is None:
            return
        with self._lock:
            self._hit_pos = 0

    def play_phrase(self, category: PhraseCategory, *, interrupt: bool = False) -> bool:
        if self._phrases is None:
            return False
        return self._phrases.play_phrase(category, interrupt=interrupt)

    def stop(self) -> None:
        if self._stream is not None:
            try:
                self._stream.stop()
                self._stream.close()
            except Exception:
                pass
            self._stream = None


class GameAudio:
    """Background music + Kazakh UI voice phrases for the projector tile game."""

    def __init__(
        self,
        *,
        assets_dir: Path,
        music_volume: float = 0.28,
        sfx_volume: float = 0.85,
        phrase_volume: float = 0.95,
        phrases_enabled: bool = True,
    ) -> None:
        assets_dir = assets_dir.resolve()
        music_path = assets_dir / MUSIC_LOOP_FILENAME
        hit_path = assets_dir / HIT_SFX_FILENAME
        phrases_dir = default_phrases_dir(assets_dir)
        common = dict(
            music_path=music_path,
            hit_path=hit_path,
            phrases_dir=phrases_dir,
            music_volume=music_volume,
            sfx_volume=sfx_volume,
            phrase_volume=phrase_volume,
            phrases_enabled=phrases_enabled,
        )

        if _pygame_mixer_usable():
            self._impl: _PygameGameAudio | _SounddeviceGameAudio = _PygameGameAudio(**common)
        else:
            print(
                "GameAudio: pygame.mixer not in this build — using sounddevice for audio.",
                file=sys.stderr,
            )
            self._impl = _SounddeviceGameAudio(**common)

        self._positive_hit_count = 0

    def _play(self, category: PhraseCategory, *, interrupt: bool = False) -> bool:
        return self._impl.play_phrase(category, interrupt=interrupt)

    def play_positive(self) -> bool:
        """Successful tile hit — praise phrase every ``POSITIVE_PHRASE_STRIDE`` hits."""
        self._positive_hit_count += 1
        if self._positive_hit_count < POSITIVE_PHRASE_STRIDE:
            return False
        self._positive_hit_count = 0
        return self._play("positive")

    def play_correction(self) -> bool:
        """Missed tile — rotates through correction_* phrases."""
        return self._play("correction")

    def play_motivation(self) -> bool:
        """Combo / bonus — rotates through motivation_* phrases."""
        return self._play("motivation", interrupt=True)

    def play_intro_start(self) -> bool:
        """Session start — intro_01 / intro_02 alternates."""
        return self._play("intro_start", interrupt=True)

    def play_intro_end(self) -> bool:
        """Session end — «сеанс аяқталды»."""
        return self._play("intro_end", interrupt=True)

    def play_hit(self) -> None:
        """Backward-compatible: voice praise on hit (no coin SFX)."""
        if not self.play_positive():
            self._impl.play_hit()

    def stop(self) -> None:
        self._impl.stop()
