from __future__ import annotations

import subprocess
import sys
from pathlib import Path


def test_cli_help() -> None:
    res = subprocess.run(
        [sys.executable, "-m", "app.cli", "--help"],
        capture_output=True,
        text=True,
    )
    assert res.returncode == 0
    assert "Cosmo Constellation Simulator CLI" in res.stdout


def test_cli_all_scenarios() -> None:
    res = subprocess.run(
        [sys.executable, "-m", "app.cli", "--all"],
        capture_output=True,
        text=True,
    )
    assert res.returncode == 0
    assert "01_full_constellation.json" in res.stdout
    assert "98.10%" in res.stdout
    assert "02_first_launch.json" in res.stdout


def test_cli_single_scenario_export(tmp_path: Path) -> None:
    data_dir = Path(__file__).resolve().parents[2] / "data"
    if not data_dir.exists():
        data_dir = Path(__file__).resolve().parents[2] / "Данные"
    sc_file = data_dir / "01_full_constellation.json"
    out_file = tmp_path / "result.json"

    res = subprocess.run(
        [sys.executable, "-m", "app.cli", "--scenario", str(sc_file), "--export", str(out_file)],
        capture_output=True,
        text=True,
    )
    assert res.returncode == 0
    assert out_file.exists()
    assert '"schema_version": "cosmo-A-result-1.0"' in out_file.read_text(encoding="utf-8")
