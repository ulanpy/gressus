"""Tests for the allowlisted projector runtime commands."""

from gressus_session.runtime_jobs import build_command


def test_build_game_command() -> None:
    command = build_command(
        "game",
        {
            "mode": "existing_insole",
            "outputRotation": 90,
            "insoleThresholdKpa": 8,
            "speed": 2.5,
            "stepTimeS": 0.9,
            "display": "0",
        },
    )
    assert command[:4] == ["ros2", "launch", "gressus_bringup", "tile_game.launch.py"]
    assert "mode:=existing_insole" in command
    assert "speed:=2.5" in command


def test_build_calibration_command() -> None:
    command = build_command(
        "calibration",
        {
            "camera": "realsense",
            "width": 640,
            "height": 480,
            "fps": 30,
            "display": "0",
            "tagSize": 280,
            "margin": 30,
            "outputRotation": 90,
        },
    )
    assert command[:4] == ["ros2", "launch", "gressus_bringup", "calibrate.launch.py"]
    assert "output_rotation:=90" in command
