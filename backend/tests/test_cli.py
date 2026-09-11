from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path
from typing import Any
from unittest.mock import patch

import pytest

from app.cli import main, print_table, process_scenario
from tests.conftest import resolve_preset_path

pytestmark = pytest.mark.unit


@pytest.mark.unit
def test_cli_help() -> None:
    res = subprocess.run(
        [sys.executable, "-m", "app.cli", "--help"],
        capture_output=True,
        text=True,
    )
    assert res.returncode == 0
    assert "Cosmo Constellation Simulator CLI" in res.stdout


@pytest.mark.unit
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


@pytest.mark.unit
def test_cli_single_scenario_export(tmp_path: Path) -> None:
    sc_file = resolve_preset_path("01_full_constellation.json")
    out_file = tmp_path / "result.json"

    res = subprocess.run(
        [sys.executable, "-m", "app.cli", "--scenario", str(sc_file), "--export", str(out_file)],
        capture_output=True,
        text=True,
    )
    assert res.returncode == 0
    assert out_file.exists()
    assert '"schema_version": "cosmo-A-result-1.0"' in out_file.read_text(encoding="utf-8")


@pytest.mark.unit
def test_cli_main_in_process_no_args(capsys: pytest.CaptureFixture[str]) -> None:
    with patch.object(sys, "argv", ["app.cli"]):
        with pytest.raises(SystemExit) as exc_info:
            main()
        assert exc_info.value.code == 1


@pytest.mark.unit
def test_cli_main_in_process_all() -> None:
    with patch.object(sys, "argv", ["app.cli", "--all", "--metric", "hops"]):
        with pytest.raises(SystemExit) as exc_info:
            main()
        assert exc_info.value.code == 0


@pytest.mark.unit
def test_cli_main_in_process_all_missing_dir() -> None:
    with patch("app.cli.Path.exists", return_value=False):
        with patch.object(sys, "argv", ["app.cli", "--all"]):
            with pytest.raises(SystemExit) as exc_info:
                main()
            assert exc_info.value.code == 1


@pytest.mark.unit
def test_cli_main_in_process_all_no_json(tmp_path: Path) -> None:
    empty_data = tmp_path / "data"
    empty_data.mkdir()
    with patch(
        "app.cli.Path",
        side_effect=lambda *args: empty_data if args and args[0] == "data" else Path(*args),
    ):
        with patch.object(sys, "argv", ["app.cli", "--all"]):
            with pytest.raises(SystemExit) as exc_info:
                main()
            assert exc_info.value.code == 1


@pytest.mark.unit
def test_cli_main_in_process_single(tmp_path: Path) -> None:
    sc_file = resolve_preset_path("01_full_constellation.json")
    out_file = tmp_path / "out.json"

    with patch.object(
        sys, "argv", ["app.cli", "-s", str(sc_file), "-e", str(out_file), "-m", "delay"]
    ):
        with pytest.raises(SystemExit) as exc_info:
            main()
        assert exc_info.value.code == 0
        assert out_file.exists()


@pytest.mark.unit
def test_cli_main_in_process_single_fail() -> None:
    sc_file = resolve_preset_path("02_first_launch.json")

    with patch.object(sys, "argv", ["app.cli", "-s", str(sc_file)]):
        with pytest.raises(SystemExit) as exc_info:
            main()
        assert exc_info.value.code == 1


@pytest.mark.unit
def test_process_scenario_nonexistent_file(tmp_path: Path) -> None:
    assert process_scenario(tmp_path / "non_existent.json") is False


@pytest.mark.unit
def test_process_scenario_invalid_json(tmp_path: Path) -> None:
    bad_file = tmp_path / "bad.json"
    bad_file.write_text("{not: valid json", encoding="utf-8")
    assert process_scenario(bad_file) is False


@pytest.mark.unit
def test_process_scenario_validation_error(tmp_path: Path) -> None:
    val_file = tmp_path / "invalid_scenario.json"
    val_file.write_text(json.dumps({"schema_version": "wrong"}), encoding="utf-8")
    assert process_scenario(val_file) is False


@pytest.mark.unit
def test_print_table_all_failures() -> None:
    res: dict[str, Any] = {
        "total_steps": 10,
        "step_s": 120,
        "client_metrics": {
            "C1": {
                "availability_pct": 0.0,
                "availability_ratio": 0.0,
                "max_outage_s": 1200,
                "meets_target": False,
                "failure_breakdown": {
                    "no_client_satellite": 2,
                    "gateway_offline": 3,
                    "no_gateway_satellite": 2,
                    "isl_disconnected": 3,
                },
            }
        },
        "summary": {
            "average_availability_pct": 0.0,
            "all_meet_target": False,
        },
    }
    print_table("Test_Failures", res, target_sla=0.9)


@pytest.mark.unit
def test_cli_metric_distance_and_delay(tmp_path: Path) -> None:
    sc_file = resolve_preset_path("02_first_launch.json")
    # Test distance metric
    with patch.object(sys, "argv", ["app.cli", "-s", str(sc_file), "-m", "distance"]):
        with pytest.raises(SystemExit) as exc:
            main()
        assert exc.value.code in (0, 1)

    # Test delay alias metric
    with patch.object(sys, "argv", ["app.cli", "-s", str(sc_file), "-m", "delay"]):
        with pytest.raises(SystemExit) as exc:
            main()
        assert exc.value.code in (0, 1)
