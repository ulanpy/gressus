from __future__ import annotations

import sys
import threading
import wave
from pathlib import Path

import numpy as np
import pygame

# Default files under repo `assets/` (see assets/CREDITS.txt).
MUSIC_LOOP_FILENAME = "716637__audiocoffee__happy-music-loop1.wav"
HIT_SFX_FILENAME = "402288__lilmati__retro-coin-02.wav"


def default_assets_dir() -> Path:
    return Path(__file__).resolve().parent.parent.parent / "assets"


def _clip01(x: float) -> float:
    return max(0.0, min(1.0, x))


def _pygame_mixer_usable() -> bool:
    """True if pygame was built with SDL_mixer (some distro wheels omit it)."""
    try:
        # Attribute access alone can succeed lazily; calling get_init forces real load.
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


class _PygameGameAudio:
    def __init__(
        self,
        *,
        music_path: Path,
        hit_path: Path,
        music_volume: float,
        sfx_volume: float,
    ) -> None:
        self._hit: pygame.mixer.Sound | None = None
        self._music_started = False

        if not pygame.mixer.get_init():
            pygame.mixer.init(frequency=44100, size=-16, channels=2, buffer=4096)

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

    def play_hit(self) -> None:
        if self._hit is not None:
            self._hit.play()

    def stop(self) -> None:
        if self._music_started:
            try:
                pygame.mixer.music.stop()
            except Exception:
                pass


class _SounddeviceGameAudio:
    """Loop BGM + one-shot SFX in one PortAudio stream (no pygame.mixer)."""

    def __init__(
        self,
        *,
        music_path: Path,
        hit_path: Path,
        music_volume: float,
        sfx_volume: float,
    ) -> None:
        import sounddevice as sd

        self._sd = sd
        mv = float(_clip01(music_volume))
        sv = float(_clip01(sfx_volume))
        self._lock = threading.Lock()
        self._music: np.ndarray
        self._music_i = 0
        self._hit_full: np.ndarray | None = None
        self._hit_pos: int | None = None
        self._stream: object | None = None

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

    def stop(self) -> None:
        if self._stream is not None:
            try:
                self._stream.stop()
                self._stream.close()
            except Exception:
                pass
            self._stream = None


class GameAudio:
    """Background music (looped) + hit SFX: pygame.mixer when available, else sounddevice."""

    def __init__(
        self,
        *,
        assets_dir: Path,
        music_volume: float = 0.32,
        sfx_volume: float = 0.85,
    ) -> None:
        assets_dir = assets_dir.resolve()
        music_path = assets_dir / MUSIC_LOOP_FILENAME
        hit_path = assets_dir / HIT_SFX_FILENAME

        if _pygame_mixer_usable():
            self._impl: _PygameGameAudio | _SounddeviceGameAudio = _PygameGameAudio(
                music_path=music_path,
                hit_path=hit_path,
                music_volume=music_volume,
                sfx_volume=sfx_volume,
            )
        else:
            print(
                "GameAudio: pygame.mixer not in this build — using sounddevice for audio.",
                file=sys.stderr,
            )
            self._impl = _SounddeviceGameAudio(
                music_path=music_path,
                hit_path=hit_path,
                music_volume=music_volume,
                sfx_volume=sfx_volume,
            )

    def play_hit(self) -> None:
        self._impl.play_hit()

    def stop(self) -> None:
        self._impl.stop()
