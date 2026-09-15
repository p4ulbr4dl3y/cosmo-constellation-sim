from __future__ import annotations

import copy
import json
import subprocess
import sys
from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient
import pytest

from app.core.export import export_result
from app.core.simulator import run_simulation, simulate_scenario
from app.core.validator import validate_scenario
from app.models.schemas import Scenario

pytestmark = pytest.mark.integration


@pytest.mark.integration
class TestPipelineE2E:
    """Task 1: End-to-end pipeline with real scenario files."""

    def test_e2e_pipeline_baseline(
        self,
        baseline_scenario_path: Path,
        baseline_scenario_data: dict[str, Any],
        baseline_scenario: Scenario,
    ) -> None:
        assert baseline_scenario_path.exists()
        assert baseline_scenario.schema_version == "cosmo-A-1.0"
        scenario = baseline_scenario_data

        # 1. Validate scenario
        errors = validate_scenario(scenario)
        assert errors == [], f"Validation unexpected errors: {errors}"

        # 2. Simulate scenario (test both simulate_scenario alias and run_simulation)
        sim_result = simulate_scenario(scenario, metric="hops", include_timeline=True)
        assert sim_result["total_steps"] == 720
        assert sim_result["summary"]["all_meet_target"] is True
        assert sim_result["summary"]["average_availability_pct"] >= 95.0

        for cid in ["C65", "C70", "C72"]:
            assert cid in sim_result["client_metrics"]
            client_m = sim_result["client_metrics"][cid]
            assert client_m["availability_pct"] >= 90.0
            assert client_m["meets_target"] is True
            assert len(client_m["timeline"]) == 720

        assert len(sim_result["routes"]) == 720 * 3

        # 3. Export result
        exported = export_result(
            scenario=scenario,
            metric="hops",
            routes=sim_result["routes"],
            client_metrics=sim_result["client_metrics"],
            summary=sim_result["summary"],
        )

        # 4. Validate output schema structure cosmo-A-result-1.0
        assert exported["schema_version"] == "cosmo-A-result-1.0"
        assert "effective_scenario" in exported
        assert exported["effective_scenario"]["schema_version"] == "cosmo-A-1.0"
        assert "routes" in exported
        assert len(exported["routes"]) == 720 * 3
        assert "metrics" in exported
        assert "summary" in exported

        first_route = exported["routes"][0]
        assert "t_s" in first_route
        assert "client_id" in first_route
        assert "path" in first_route
        assert isinstance(first_route["path"], list)

        for _cid, m in exported["metrics"].items():
            assert "availability_pct" in m
            assert "availability_ratio" in m
            assert "max_outage_s" in m
            assert "timeline" not in m
            assert "outage_intervals" not in m

    def test_e2e_pipeline_delay_metric(self, baseline_scenario_data: dict[str, Any]) -> None:
        scenario = baseline_scenario_data
        errors = validate_scenario(scenario)
        assert errors == []

        sim_result = run_simulation(scenario, metric="delay", include_timeline=False)
        assert sim_result["summary"]["all_meet_target"] is True

        exported = export_result(scenario, metric="delay")
        assert exported["schema_version"] == "cosmo-A-result-1.0"
        assert len(exported["routes"]) == 720 * 3


@pytest.mark.integration
class TestApiMultiStepFlow:
    """Task 2: Multi-step API integration flow using TestClient."""

    def test_api_v1_full_lifecycle(
        self, api_client: TestClient, baseline_scenario_data: dict[str, Any]
    ) -> None:
        scenario = baseline_scenario_data

        # Step 1: POST /api/v1/validate
        val_res = api_client.post("/api/v1/validate", json=scenario)
        assert val_res.status_code == 200
        val_data = val_res.json()
        assert val_data["valid"] is True
        assert val_data["errors"] == []

        # Step 2: POST /api/v1/simulate with full scenario and timeline
        sim_res = api_client.post(
            "/api/v1/simulate",
            json={
                "scenario": scenario,
                "routing_metric": "hops",
                "include_timeline": True,
            },
        )
        assert sim_res.status_code == 200
        sim_data = sim_res.json()

        assert "client_metrics" in sim_data
        assert "summary" in sim_data
        assert sim_data["summary"]["all_meet_target"] is True
        assert sim_data["summary"]["average_availability_pct"] >= 95.0

        for cid in ["C65", "C70", "C72"]:
            cm = sim_data["client_metrics"][cid]
            assert cm["availability_pct"] >= 90.0
            assert cm["meets_target"] is True
            assert "timeline" in cm
            assert len(cm["timeline"]) == 720
            first_point = cm["timeline"][0]
            assert "t_s" in first_point
            assert "status" in first_point

        # Step 3: POST /api/v1/snapshot at t=0, t=1800, t=3600
        for t_val in [0.0, 1800.0, 3600.0]:
            snap_res = api_client.post(
                "/api/v1/snapshot",
                json={
                    "scenario": scenario,
                    "t_s": t_val,
                    "routing_metric": "hops",
                },
            )
            assert snap_res.status_code == 200
            snap_data = snap_res.json()

            assert snap_data["t_s"] == t_val
            assert len(snap_data["satellites"]) == 48
            assert len(snap_data["edges"]) > 0
            assert "client_routes" in snap_data
            for cid in ["C65", "C70", "C72"]:
                assert cid in snap_data["client_routes"]
                route_info = snap_data["client_routes"][cid]
                assert route_info["status"] in ("ok", "fail")
                if route_info["status"] == "ok":
                    assert len(route_info["path"]) >= 2

        # Step 4: POST /api/v1/export
        export_res = api_client.post(
            "/api/v1/export",
            json={
                "scenario": scenario,
                "routing_metric": "hops",
            },
        )
        assert export_res.status_code == 200
        export_data = export_res.json()
        assert export_data["schema_version"] == "cosmo-A-result-1.0"
        assert "effective_scenario" in export_data
        assert "routes" in export_data
        assert len(export_data["routes"]) == 720 * 3
        assert "metrics" in export_data
        assert "summary" in export_data

        # Step 5: POST /api/v1/compare with baseline vs stage 2 scenario
        stage2_scenario = copy.deepcopy(scenario)
        stage2_scenario["meta"]["id"] = "stage_2_evaluation"
        stage2_scenario["design"]["launch_stage"] = 2

        cmp_res = api_client.post(
            "/api/v1/compare",
            json={
                "scenario_a": scenario,
                "scenario_b": stage2_scenario,
                "routing_metric": "hops",
            },
        )
        assert cmp_res.status_code == 200
        cmp_data = cmp_res.json()

        assert "parameter_differences" in cmp_data
        diffs = {
            d["field"]: (d["value_a"], d["value_b"]) for d in cmp_data["parameter_differences"]
        }
        assert "design.launch_stage" in diffs
        assert diffs["design.launch_stage"] == (3, 2)

        assert "summary" in cmp_data
        summary = cmp_data["summary"]
        assert "delta_average_availability_pct" in summary
        assert "delta_min_availability_pct" in summary
        # Stage 2 has fewer operational satellites, availability decreases
        assert summary["delta_average_availability_pct"] < 0

        assert "client_comparison" in cmp_data
        for cid in ["C65", "C70", "C72"]:
            assert cid in cmp_data["client_comparison"]
            c_comp = cmp_data["client_comparison"][cid]
            assert "delta_availability_pct" in c_comp
            assert c_comp["delta_availability_pct"] < 0

    def test_api_v1_error_handling(
        self, api_client: TestClient, baseline_scenario_data: dict[str, Any]
    ) -> None:
        bad_scenario = {"invalid": "format"}

        res_val = api_client.post("/api/v1/validate", json=bad_scenario)
        assert res_val.status_code == 200
        assert res_val.json()["valid"] is False
        assert len(res_val.json()["errors"]) > 0

        res_sim = api_client.post("/api/v1/simulate", json={"scenario": bad_scenario})
        assert res_sim.status_code == 422

        res_snap = api_client.post("/api/v1/snapshot", json={"scenario": bad_scenario, "t_s": 0.0})
        assert res_snap.status_code == 422

        valid_sc = baseline_scenario_data
        res_cmp = api_client.post(
            "/api/v1/compare",
            json={"scenario_a": bad_scenario, "scenario_b": valid_sc},
        )
        assert res_cmp.status_code == 422


@pytest.mark.integration
class TestCliE2E:
    """Task 3: CLI end-to-end invocation."""

    def test_cli_invocation_baseline_export(
        self, tmp_path: Path, baseline_scenario_path: Path
    ) -> None:
        scenario_path = baseline_scenario_path
        out_file = tmp_path / "cli_exported_result.json"

        cmd = [
            sys.executable,
            "-m",
            "app.cli",
            "--scenario",
            str(scenario_path),
            "--export",
            str(out_file),
            "--metric",
            "hops",
        ]
        res = subprocess.run(cmd, capture_output=True, text=True)

        assert res.returncode == 0, f"CLI stderr: {res.stderr}"
        assert "СЦЕНАРИЙ" in res.stdout
        assert "SLA (%)" in res.stdout
        assert "C65" in res.stdout
        assert "C70" in res.stdout
        assert "C72" in res.stdout
        assert "ДОСТИГНУТА" in res.stdout

        assert out_file.exists()
        out_data = json.loads(out_file.read_text(encoding="utf-8"))
        assert out_data["schema_version"] == "cosmo-A-result-1.0"
        assert "routes" in out_data
        assert "metrics" in out_data
        assert "summary" in out_data
        assert out_data["summary"]["all_meet_target"] is True

    def test_cli_invocation_invalid_file(self) -> None:
        cmd = [sys.executable, "-m", "app.cli", "--scenario", "non_existent_file.json"]
        res = subprocess.run(cmd, capture_output=True, text=True)
        assert res.returncode != 0
        assert "не найден" in res.stderr

    def test_cli_invocation_all(self) -> None:
        cmd = [sys.executable, "-m", "app.cli", "--all", "--metric", "hops"]
        res = subprocess.run(cmd, capture_output=True, text=True)
        assert res.returncode == 0
        assert "01_full_constellation.json" in res.stdout
