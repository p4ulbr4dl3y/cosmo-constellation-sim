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


def test_compare_scenarios_branches():
    s1 = json.loads(get_preset_path("01_full_constellation.json").read_text(encoding="utf-8"))
    s2 = json.loads(get_preset_path("01_full_constellation.json").read_text(encoding="utf-8"))

    # Identical scenarios (delta == 0)
    comp_same = compare_scenarios(s1, s2, metric="hops")
    assert "Средняя доступность вариантов идентична." in comp_same["summary"]["recommendation"]

    # B beats A (s2 is full, s1 is first launch)
    s_first = json.loads(get_preset_path("02_first_launch.json").read_text(encoding="utf-8"))
    comp_better = compare_scenarios(s_first, s1, metric="hops")
    assert "превосходит вариант A" in comp_better["summary"]["recommendation"]
    assert "все пункты вышли на целевой уровень" in comp_better["summary"]["recommendation"]

    # Diff parameters branches: diff environment key, plane parameter, sat count, failures, gateway outages
    s_mod = json.loads(json.dumps(s1))
    s_mod["environment"]["isl_range_km"] = 4000.0
    s_mod["design"]["planes"][0]["raan_deg"] = 10.0
    s_mod["design"]["satellites"].pop()
    s_mod["failures"] = [
        {"satellite_id": s_mod["design"]["satellites"][0]["id"], "start_s": 0, "end_s": 100}
    ]
    s_mod["gateway_outages"] = [{"gateway_id": "G_MUR", "start_s": 0, "end_s": 100}]

    diff = compare_scenarios(s1, s_mod, metric="hops")
    fields = [d["field"] for d in diff["parameter_differences"]]
    assert "environment.isl_range_km" in fields
    assert "design.planes[P1]" in fields
    assert "design.satellites_count" in fields
    assert "failures_count" in fields
    assert "gateway_outages_count" in fields


def test_routing_classify_failure_and_direct_edge_cases():
    from app.core.routing import (
        classify_failure,
        find_route,
        FAILURE_REASON_NO_CLIENT_SAT,
        FAILURE_REASON_GATEWAY_OFFLINE,
        FAILURE_REASON_NO_GW_SAT,
        FAILURE_REASON_ISL_DISCONNECTED,
    )
    from app.core.geometry import finite

    # geometry finite helper
    assert finite(123.45) is True
    assert finite(True) is False
    assert finite(float("inf")) is False

    # classify failure codes
    code1, _ = classify_failure(False, 1, True)
    assert code1 == FAILURE_REASON_NO_CLIENT_SAT

    code2, _ = classify_failure(True, 0, True)
    assert code2 == FAILURE_REASON_GATEWAY_OFFLINE

    code3, _ = classify_failure(True, 1, False)
    assert code3 == FAILURE_REASON_NO_GW_SAT

    code4, _ = classify_failure(True, 1, True)
    assert code4 == FAILURE_REASON_ISL_DISCONNECTED

    # find_route directly with gateway as direct neighbour without satellite (len(path) < 2)
    # direct edge from C1 to G1: should be skipped!
    adj = {
        "C1": [("G1", 100.0)],
        "G1": [("C1", 100.0)],
    }
    path, dist = find_route(
        adj=adj,
        client_id="C1",
        online_gateways={"G1"},
        all_clients={"C1"},
        metric="hops",
    )
    assert path == []
    assert dist == 0.0

    # find_route with delay metric
    adj_valid = {
        "C1": [("SAT1", 1000.0)],
        "SAT1": [("C1", 1000.0), ("G1", 1000.0)],
        "G1": [("SAT1", 1000.0)],
    }
    path_delay, dist_delay = find_route(
        adj=adj_valid,
        client_id="C1",
        online_gateways={"G1"},
        all_clients={"C1"},
        metric="delay",
    )
    assert path_delay == ["C1", "SAT1", "G1"]
    assert dist_delay == 2000.0
