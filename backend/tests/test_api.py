import json
from pathlib import Path
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def get_preset_scenario(name: str = "01_full_constellation.json") -> dict:
    candidates = [
        Path.cwd() / "data" / name,
        Path.cwd().parent / "data" / name,
        Path(__file__).resolve().parents[2] / "data" / name,
        Path(__file__).resolve().parents[1] / "data" / name,
        Path.cwd() / "Данные" / name,
        Path.cwd().parent / "Данные" / name,
        Path(__file__).resolve().parents[2] / "Данные" / name,
        Path(__file__).resolve().parents[1] / "Данные" / name,
    ]
    for c in candidates:
        if c.exists():
            return json.loads(c.read_text(encoding="utf-8"))
    raise FileNotFoundError(f"Preset {name} not found")


def test_api_health():
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"


def test_api_get_presets():
    res = client.get("/api/presets")
    assert res.status_code == 200
    presets = res.json()
    assert len(presets) >= 4
    ids = [p["id"] for p in presets]
    assert "01_full_constellation" in ids


def test_api_get_preset_by_name():
    res = client.get("/api/presets/01_full_constellation")
    assert res.status_code == 200
    data = res.json()
    assert data["schema_version"] == "cosmo-A-1.0"


def test_api_get_preset_not_found():
    res = client.get("/api/presets/not_exist")
    assert res.status_code == 404


def test_api_validate_valid():
    scenario = get_preset_scenario()
    res = client.post("/api/validate", json=scenario)
    assert res.status_code == 200
    assert res.json() == {"valid": True, "errors": [], "warnings": []}


def test_api_validate_invalid():
    scenario = get_preset_scenario()
    scenario["schema_version"] = "bad"
    res = client.post("/api/validate", json=scenario)
    assert res.status_code == 200
    body = res.json()
    assert body["valid"] is False
    assert len(body["errors"]) > 0


def test_api_snapshot():
    scenario = get_preset_scenario()
    res = client.post("/api/snapshot", json={"scenario": scenario, "t_s": 0.0})
    assert res.status_code == 200
    body = res.json()
    assert body["t_s"] == 0.0
    assert len(body["satellites"]) == 48
    assert len(body["ground_sites"]) == 4
    assert len(body["edges"]) > 0
    assert "client_routes" in body
    assert "C65" in body["client_routes"]
    assert body["client_routes"]["C65"]["status"] == "ok"


def test_api_snapshot_outage():
    scenario = get_preset_scenario("02_first_launch.json")
    # At t_s = 0.0, first launch has client outages
    res = client.post("/api/snapshot", json={"scenario": scenario, "t_s": 0.0})
    assert res.status_code == 200
    body = res.json()
    outage_routes = [r for r in body["client_routes"].values() if r["status"] == "outage"]
    assert len(outage_routes) > 0
    assert outage_routes[0]["failure_code"] is not None


def test_api_simulate():
    scenario = get_preset_scenario()
    res = client.post(
        "/api/simulate",
        json={
            "scenario": scenario,
            "routing_metric": "hops",
            "include_timeline": False,
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["total_steps"] == 720
    assert "client_metrics" in body
    assert body["summary"]["all_meet_target"] is True


def test_api_export():
    scenario = get_preset_scenario()
    res = client.post("/api/export", json={"scenario": scenario, "routing_metric": "hops"})
    assert res.status_code == 200
    body = res.json()
    assert body["schema_version"] == "cosmo-A-result-1.0"
    assert "effective_scenario" in body
    assert "routes" in body


def test_api_compare():
    s1 = get_preset_scenario("01_full_constellation.json")
    s2 = get_preset_scenario("02_first_launch.json")
    res = client.post(
        "/api/compare",
        json={"scenario_a": s1, "scenario_b": s2, "routing_metric": "hops"},
    )
    assert res.status_code == 200
    body = res.json()
    assert "parameter_differences" in body
    assert "summary" in body
    assert "client_comparison" in body


def test_api_recommendations():
    res = client.get("/api/recommendations")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "success"
    assert "recommendations" in body
    assert len(body["recommendations"]) > 0


def test_api_report_export():
    res = client.get("/api/report/export")
    assert res.status_code == 200
    body = res.json()
    assert body["format"] == "markdown"
    assert "markdown" in body

    res_md = client.get("/api/report/export?format=markdown")
    assert res_md.status_code == 200
    assert "Инженерный отчет" in res_md.text


def test_api_root():
    res = client.get("/")
    assert res.status_code == 200
    assert res.json()["service"] == "cosmo-constellation-backend"


def test_api_compare_validation_errors():
    s_valid = get_preset_scenario("01_full_constellation.json")
    s_invalid = {"schema_version": "bad"}

    res_a = client.post(
        "/api/compare",
        json={"scenario_a": s_invalid, "scenario_b": s_valid, "routing_metric": "hops"},
    )
    assert res_a.status_code == 422
    assert "Сценарий A содержит ошибки валидации" in res_a.json()["detail"]["message"]

    res_b = client.post(
        "/api/compare",
        json={"scenario_a": s_valid, "scenario_b": s_invalid, "routing_metric": "hops"},
    )
    assert res_b.status_code == 422
    assert "Сценарий B содержит ошибки валидации" in res_b.json()["detail"]["message"]


def test_api_simulate_and_export_validation_errors():
    s_invalid = {"schema_version": "bad"}

    res_sim = client.post("/api/simulate", json={"scenario": s_invalid})
    assert res_sim.status_code == 422

    res_snap = client.post("/api/snapshot", json={"scenario": s_invalid, "t_s": 0.0})
    assert res_snap.status_code == 422

    res_exp = client.post("/api/export", json={"scenario": s_invalid})
    assert res_exp.status_code == 422


def test_api_report_export_fallback_and_preset_errors(tmp_path: Path):
    from unittest.mock import patch

    with patch("app.api.v1.analysis.find_recommendations_doc", return_value=None):
        res = client.get("/api/report/export")
        assert res.status_code == 200
        assert "SLA: 98.10%" in res.json()["markdown"]

    with patch("app.api.v1.presets.find_data_dir", return_value=tmp_path / "empty_nonexistent"):
        res = client.get("/api/presets")
        assert res.status_code == 200
        assert res.json() == []

    # Corrupted preset file
    bad_dir = tmp_path / "presets"
    bad_dir.mkdir()
    (bad_dir / "corrupted.json").write_text("invalid json", encoding="utf-8")
    with patch("app.api.v1.presets.find_data_dir", return_value=bad_dir):
        # get_presets skips corrupt files
        res_list = client.get("/api/presets")
        assert res_list.status_code == 200
        assert res_list.json() == []

        # get_preset returns 500
        res_single = client.get("/api/presets/corrupted")
        assert res_single.status_code == 500
