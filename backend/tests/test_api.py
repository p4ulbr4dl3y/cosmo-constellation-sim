from __future__ import annotations

import copy
import json
from pathlib import Path
from typing import Any
from unittest.mock import patch

from fastapi.testclient import TestClient
import pytest

from tests.conftest import resolve_preset_path

pytestmark = pytest.mark.unit


def get_preset_scenario(name: str = "01_full_constellation.json") -> dict[str, Any]:
    return json.loads(resolve_preset_path(name).read_text(encoding="utf-8"))


@pytest.mark.unit
def test_api_health(api_client: TestClient) -> None:
    res = api_client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"


@pytest.mark.unit
def test_api_get_presets(api_client: TestClient) -> None:
    res = api_client.get("/api/presets")
    assert res.status_code == 200
    presets = res.json()
    assert len(presets) >= 4
    ids = [p["id"] for p in presets]
    assert "01_full_constellation" in ids


@pytest.mark.unit
def test_api_get_preset_by_name(api_client: TestClient) -> None:
    res = api_client.get("/api/presets/01_full_constellation")
    assert res.status_code == 200
    data = res.json()
    assert data["schema_version"] == "cosmo-A-1.0"


@pytest.mark.unit
def test_api_get_preset_not_found(api_client: TestClient) -> None:
    res = api_client.get("/api/presets/not_exist")
    assert res.status_code == 404


@pytest.mark.unit
def test_api_validate_valid(api_client: TestClient, baseline_scenario_data: dict[str, Any]) -> None:
    res = api_client.post("/api/validate", json=baseline_scenario_data)
    assert res.status_code == 200
    assert res.json() == {"valid": True, "errors": [], "warnings": []}


@pytest.mark.unit
def test_api_validate_invalid(
    api_client: TestClient, baseline_scenario_data: dict[str, Any]
) -> None:
    scenario = copy.deepcopy(baseline_scenario_data)
    scenario["schema_version"] = "bad"
    res = api_client.post("/api/validate", json=scenario)
    assert res.status_code == 200
    body = res.json()
    assert body["valid"] is False
    assert len(body["errors"]) > 0


@pytest.mark.unit
def test_api_snapshot(api_client: TestClient, baseline_scenario_data: dict[str, Any]) -> None:
    res = api_client.post("/api/snapshot", json={"scenario": baseline_scenario_data, "t_s": 0.0})
    assert res.status_code == 200
    body = res.json()
    assert body["t_s"] == 0.0
    assert len(body["satellites"]) == 48
    assert len(body["ground_sites"]) == 4
    assert len(body["edges"]) > 0
    assert "client_routes" in body
    assert "C65" in body["client_routes"]
    assert body["client_routes"]["C65"]["status"] == "ok"


@pytest.mark.unit
def test_api_snapshot_outage(api_client: TestClient) -> None:
    scenario = get_preset_scenario("02_first_launch.json")
    res = api_client.post("/api/snapshot", json={"scenario": scenario, "t_s": 0.0})
    assert res.status_code == 200
    body = res.json()
    outage_routes = [r for r in body["client_routes"].values() if r["status"] == "outage"]
    assert len(outage_routes) > 0
    assert outage_routes[0]["failure_code"] is not None


@pytest.mark.unit
def test_api_simulate(api_client: TestClient, baseline_scenario_data: dict[str, Any]) -> None:
    res = api_client.post(
        "/api/simulate",
        json={
            "scenario": baseline_scenario_data,
            "routing_metric": "hops",
            "include_timeline": False,
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["total_steps"] == 720
    assert "client_metrics" in body
    assert body["summary"]["all_meet_target"] is True


@pytest.mark.unit
def test_api_export(api_client: TestClient, baseline_scenario_data: dict[str, Any]) -> None:
    res = api_client.post(
        "/api/export", json={"scenario": baseline_scenario_data, "routing_metric": "hops"}
    )
    assert res.status_code == 200
    body = res.json()
    assert body["schema_version"] == "cosmo-A-result-1.0"
    assert "effective_scenario" in body
    assert "routes" in body


@pytest.mark.unit
def test_api_compare(api_client: TestClient, baseline_scenario_data: dict[str, Any]) -> None:
    s2 = get_preset_scenario("02_first_launch.json")
    res = api_client.post(
        "/api/compare",
        json={"scenario_a": baseline_scenario_data, "scenario_b": s2, "routing_metric": "hops"},
    )
    assert res.status_code == 200
    body = res.json()
    assert "parameter_differences" in body
    assert "summary" in body
    assert "client_comparison" in body


@pytest.mark.unit
def test_api_recommendations(api_client: TestClient) -> None:
    res = api_client.get("/api/recommendations")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "success"
    assert "recommendations" in body
    assert len(body["recommendations"]) > 0


@pytest.mark.unit
def test_api_report_export(api_client: TestClient) -> None:
    res = api_client.get("/api/report/export")
    assert res.status_code == 200
    body = res.json()
    assert body["format"] == "markdown"
    assert "markdown" in body

    res_md = api_client.get("/api/report/export?format=markdown")
    assert res_md.status_code == 200
    assert "Инженерный отчет" in res_md.text


@pytest.mark.unit
def test_api_root(api_client: TestClient) -> None:
    res = api_client.get("/")
    assert res.status_code == 200
    assert res.json()["service"] == "cosmo-constellation-backend"


@pytest.mark.unit
def test_api_compare_validation_errors(
    api_client: TestClient, baseline_scenario_data: dict[str, Any]
) -> None:
    s_invalid = {"schema_version": "bad"}

    res_a = api_client.post(
        "/api/compare",
        json={
            "scenario_a": s_invalid,
            "scenario_b": baseline_scenario_data,
            "routing_metric": "hops",
        },
    )
    assert res_a.status_code == 422
    assert "Сценарий A содержит ошибки валидации" in res_a.json()["detail"]["message"]

    res_b = api_client.post(
        "/api/compare",
        json={
            "scenario_a": baseline_scenario_data,
            "scenario_b": s_invalid,
            "routing_metric": "hops",
        },
    )
    assert res_b.status_code == 422
    assert "Сценарий B содержит ошибки валидации" in res_b.json()["detail"]["message"]


@pytest.mark.unit
def test_api_simulate_and_export_validation_errors(api_client: TestClient) -> None:
    s_invalid = {"schema_version": "bad"}

    res_sim = api_client.post("/api/simulate", json={"scenario": s_invalid})
    assert res_sim.status_code == 422

    res_snap = api_client.post("/api/snapshot", json={"scenario": s_invalid, "t_s": 0.0})
    assert res_snap.status_code == 422

    res_exp = api_client.post("/api/export", json={"scenario": s_invalid})
    assert res_exp.status_code == 422


@pytest.mark.unit
def test_api_report_export_fallback_and_preset_errors(
    api_client: TestClient, tmp_path: Path
) -> None:
    with patch("app.api.v1.analysis.find_recommendations_doc", return_value=None):
        res = api_client.get("/api/report/export")
        assert res.status_code == 200
        assert "SLA: 98.10%" in res.json()["markdown"]

    with patch("app.api.v1.presets.find_data_dir", return_value=tmp_path / "empty_nonexistent"):
        res = api_client.get("/api/presets")
        assert res.status_code == 200
        assert res.json() == []

    # Corrupted preset file
    bad_dir = tmp_path / "presets"
    bad_dir.mkdir()
    (bad_dir / "corrupted.json").write_text("invalid json", encoding="utf-8")
    with patch("app.api.v1.presets.find_data_dir", return_value=bad_dir):
        # get_presets skips corrupt files
        res_list = api_client.get("/api/presets")
        assert res_list.status_code == 200
        assert res_list.json() == []

        # get_preset returns 500
        res_single = api_client.get("/api/presets/corrupted")
        assert res_single.status_code == 500
