import json
from pathlib import Path

from app.core.compare import compare_scenarios
from app.core.export import export_result
from app.core.simulator import run_simulation


def get_preset_path(name: str) -> Path:
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
            return c
    raise FileNotFoundError(f"Preset {name} not found")


def test_simulate_preset_01_full():
    scenario = json.loads(get_preset_path("01_full_constellation.json").read_text(encoding="utf-8"))
    res = run_simulation(scenario, metric="hops", include_timeline=True)

    assert res["total_steps"] == 720
    assert res["summary"]["all_meet_target"] is True
    assert res["summary"]["average_availability_pct"] > 95.0

    for cid in ("C65", "C70", "C72"):
        m = res["client_metrics"][cid]
        assert m["availability_pct"] >= 90.0
        assert m["meets_target"] is True
        assert m["mean_hops"] is not None
        assert m["mean_hops"] >= 2.0
        assert len(m["timeline"]) == 720


def test_simulate_preset_02_first_launch():
    scenario = json.loads(get_preset_path("02_first_launch.json").read_text(encoding="utf-8"))
    res = run_simulation(scenario, metric="hops", include_timeline=False)

    assert res["total_steps"] == 720
    assert res["summary"]["all_meet_target"] is False
    assert res["summary"]["average_availability_pct"] < 30.0

    for cid in ("C65", "C70", "C72"):
        m = res["client_metrics"][cid]
        assert m["availability_pct"] < 50.0
        assert m["max_outage_s"] > 10000


def test_simulate_preset_03_satellite_outages():
    scenario = json.loads(get_preset_path("03_satellite_outages.json").read_text(encoding="utf-8"))
    res = run_simulation(scenario, metric="hops", include_timeline=False)

    assert res["total_steps"] == 720
    for cid in ("C65", "C70", "C72"):
        m = res["client_metrics"][cid]
        assert m["failure_breakdown"]["isl_disconnected"] > 0


def test_simulate_preset_04_link_range():
    scenario = json.loads(get_preset_path("04_link_range.json").read_text(encoding="utf-8"))
    res = run_simulation(scenario, metric="hops", include_timeline=False)

    assert res["total_steps"] == 720
    for cid in ("C65", "C70", "C72"):
        m = res["client_metrics"][cid]
        # With 2000 km range, ISL disconnections are the dominant failure
        assert m["failure_breakdown"]["isl_disconnected"] > 100


def test_export_format():
    scenario = json.loads(get_preset_path("01_full_constellation.json").read_text(encoding="utf-8"))
    exported = export_result(scenario, metric="hops")

    assert exported["schema_version"] == "cosmo-A-result-1.0"
    assert "effective_scenario" in exported
    assert "routes" in exported
    assert len(exported["routes"]) == 720 * 3  # 720 steps * 3 clients

    first_route = exported["routes"][0]
    assert "t_s" in first_route
    assert "client_id" in first_route
    assert "path" in first_route
    assert isinstance(first_route["path"], list)


def test_compare_presets():
    s1 = json.loads(get_preset_path("01_full_constellation.json").read_text(encoding="utf-8"))
    s2 = json.loads(get_preset_path("02_first_launch.json").read_text(encoding="utf-8"))

    comp = compare_scenarios(s1, s2, metric="hops")
    assert comp["summary"]["delta_average_availability_pct"] < -50.0
    assert any(d["field"] == "design.launch_stage" for d in comp["parameter_differences"])
