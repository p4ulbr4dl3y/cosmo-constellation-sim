import json
from pathlib import Path
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def get_preset_scenario(name: str = "01_full_constellation.json") -> dict:
    candidates = [
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
    res = client.post(
        "/api/export", json={"scenario": scenario, "routing_metric": "hops"}
    )
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
