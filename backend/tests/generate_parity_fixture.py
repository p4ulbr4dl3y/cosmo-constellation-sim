from __future__ import annotations

import copy
import json
from pathlib import Path

from app.core.geometry import ground_position, snapshot
from app.core.routing import build_adjacency, classify_failure, find_route
from app.core.simulator import run_simulation


def main() -> None:
    root_dir = Path(__file__).resolve().parents[2]
    baseline_path = root_dir / "data" / "01_input_baseline.json"
    if not baseline_path.exists():
        baseline_path = root_dir / "data" / "01_full_constellation.json"

    scenario = json.loads(baseline_path.read_text(encoding="utf-8"))
    out_path = root_dir / "frontend" / "src" / "lib" / "__fixtures__" / "parity_fixture.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)

    # 1. Ground positions
    ground_positions: dict[str, dict[str, float]] = {}
    for g in scenario.get("ground_sites", []):
        gp = ground_position(g)
        ground_positions[g["id"]] = {
            "id": g["id"],
            "name": g.get("name", g["id"]),
            "role": g.get("role", "client"),
            "lat_deg": float(g["lat_deg"]),
            "lon_deg": float(g["lon_deg"]),
            "x": float(gp[0]),
            "y": float(gp[1]),
            "z": float(gp[2]),
        }

    # 2. Snapshots at t = 0, 1000, and 59400 (which contains outage)
    client_ids = [g["id"] for g in scenario.get("ground_sites", []) if g.get("role") == "client"]
    gateway_ids = [g["id"] for g in scenario.get("ground_sites", []) if g.get("role") == "gateway"]
    online_gateways_default = set(gateway_ids)
    all_clients_set = set(client_ids)

    timestamps = [0, 1000, 59400]
    snapshots_data: dict[str, dict] = {}

    for t_s in timestamps:
        snap = snapshot(scenario, t_s)
        adj = build_adjacency(snap["edges"])

        # Separate ISL edges and ground edges
        isl_edges = []
        ground_edges = []
        for u, v, d in snap["edges"]:
            u_str, v_str, d_float = str(u), str(v), float(d)
            if u_str.startswith("S") and v_str.startswith("S"):
                pair = sorted([u_str, v_str])
                isl_edges.append([pair[0], pair[1], d_float])
            else:
                ground_edges.append([u_str, v_str, d_float])

        # Routes (hops metric & distance metric)
        routes_hops = {}
        routes_distance = {}
        for cid in client_ids:
            path_h, dist_h = find_route(adj, cid, online_gateways_default, all_clients_set, "hops")
            path_d, dist_d = find_route(
                adj, cid, online_gateways_default, all_clients_set, "distance"
            )
            routes_hops[cid] = {"path": path_h, "distance_km": float(dist_h)}
            routes_distance[cid] = {"path": path_d, "distance_km": float(dist_d)}

        snapshots_data[str(t_s)] = {
            "t_s": t_s,
            "satellites": snap["satellites"],
            "edges": snap["edges"],
            "isl_edges": isl_edges,
            "ground_edges": ground_edges,
            "elevations": snap["elevation_deg"],
            "routes_hops": routes_hops,
            "routes_distance": routes_distance,
        }

    # 3. Four failure classification cases
    # Case A: no_client_satellite
    sc_no_client = copy.deepcopy(scenario)
    sc_no_client["environment"]["min_elevation_deg"] = 89.0
    snap_a = snapshot(sc_no_client, 0)
    adj_a = build_adjacency(snap_a["edges"])
    path_a, _ = find_route(adj_a, "C65", {"G_MUR"}, all_clients_set, "hops")
    c_sats_a = [n for n, _ in adj_a.get("C65", []) if n.startswith("S")]
    gw_sats_a = [n for n, _ in adj_a.get("G_MUR", []) if n.startswith("S")]
    code_a, desc_a = classify_failure(bool(c_sats_a), 1, bool(gw_sats_a))

    # Case B: gateway_offline
    sc_gw_off = copy.deepcopy(scenario)
    sc_gw_off["gateway_outages"] = [{"gateway_id": "G_MUR", "start_s": 0, "end_s": 300}]
    snap_b = snapshot(sc_gw_off, 0)
    adj_b = build_adjacency(snap_b["edges"])
    path_b, _ = find_route(adj_b, "C65", set(), all_clients_set, "hops")
    c_sats_b = [n for n, _ in adj_b.get("C65", []) if n.startswith("S")]
    code_b, desc_b = classify_failure(bool(c_sats_b), 0, False)

    # Case C: no_gateway_satellite
    sc_no_gw_sat = copy.deepcopy(scenario)
    for g in sc_no_gw_sat["ground_sites"]:
        if g["id"] == "G_MUR":
            g["lat_deg"] = -40.0
            g["lon_deg"] = -150.0
    snap_c = snapshot(sc_no_gw_sat, 0)
    adj_c = build_adjacency(snap_c["edges"])
    path_c, _ = find_route(adj_c, "C65", {"G_MUR"}, all_clients_set, "hops")
    c_sats_c = [n for n, _ in adj_c.get("C65", []) if n.startswith("S")]
    gw_sats_c = [n for n, _ in adj_c.get("G_MUR", []) if n.startswith("S")]
    code_c, desc_c = classify_failure(bool(c_sats_c), 1, bool(gw_sats_c))

    # Case D: isl_disconnected
    sc_no_isl = copy.deepcopy(scenario)
    sc_no_isl["environment"]["isl_range_km"] = 500.0
    snap_d = snapshot(sc_no_isl, 0)
    adj_d = build_adjacency(snap_d["edges"])
    path_d, _ = find_route(adj_d, "C72", {"G_MUR"}, all_clients_set, "hops")
    c_sats_d = [n for n, _ in adj_d.get("C72", []) if n.startswith("S")]
    gw_sats_d = [n for n, _ in adj_d.get("G_MUR", []) if n.startswith("S")]
    code_d, desc_d = classify_failure(bool(c_sats_d), 1, bool(gw_sats_d))

    failure_cases = [
        {
            "case_id": "no_client_satellite",
            "scenario": sc_no_client,
            "t_s": 0,
            "client_id": "C65",
            "expected_path": path_a,
            "expected_code": code_a,
            "expected_desc": desc_a,
            "client_has_sat": bool(c_sats_a),
            "gw_has_sat": bool(gw_sats_a),
        },
        {
            "case_id": "gateway_offline",
            "scenario": sc_gw_off,
            "t_s": 0,
            "client_id": "C65",
            "expected_path": path_b,
            "expected_code": code_b,
            "expected_desc": desc_b,
            "client_has_sat": bool(c_sats_b),
            "gw_has_sat": False,
        },
        {
            "case_id": "no_gateway_satellite",
            "scenario": sc_no_gw_sat,
            "t_s": 0,
            "client_id": "C65",
            "expected_path": path_c,
            "expected_code": code_c,
            "expected_desc": desc_c,
            "client_has_sat": bool(c_sats_c),
            "gw_has_sat": bool(gw_sats_c),
        },
        {
            "case_id": "isl_disconnected",
            "scenario": sc_no_isl,
            "t_s": 0,
            "client_id": "C72",
            "expected_path": path_d,
            "expected_code": code_d,
            "expected_desc": desc_d,
            "client_has_sat": bool(c_sats_d),
            "gw_has_sat": bool(gw_sats_d),
        },
    ]

    # 4. Multi-step timeline segment (first 10 steps of baseline: t=0, 120, ..., 1080)
    timeline_steps = []
    for step_idx in range(10):
        t_s = step_idx * scenario["environment"]["step_s"]
        snap = snapshot(scenario, t_s)
        adj = build_adjacency(snap["edges"])
        step_routes = {}
        for cid in client_ids:
            path, dist = find_route(adj, cid, online_gateways_default, all_clients_set, "hops")
            step_routes[cid] = {
                "path": path,
                "distance_km": float(dist),
                "hops": len(path) - 1 if path else 0,
            }
        timeline_steps.append({"t_s": t_s, "routes": step_routes})

    # 5. Full 24h simulation summary metrics for baseline
    sim_res = run_simulation(scenario, metric="hops", include_timeline=False)
    summary_metrics = {
        cid: {
            "availability_pct": sim_res["client_metrics"][cid]["availability_pct"],
            "visibility_pct": sim_res["client_metrics"][cid]["visibility_pct"],
            "mean_hops": sim_res["client_metrics"][cid]["mean_hops"],
            "max_outage_s": sim_res["client_metrics"][cid]["max_outage_s"],
        }
        for cid in client_ids
    }

    fixture = {
        "scenario": scenario,
        "ground_positions": ground_positions,
        "snapshots": snapshots_data,
        "failure_cases": failure_cases,
        "timeline_steps": timeline_steps,
        "summary_metrics": summary_metrics,
    }

    out_path.write_text(json.dumps(fixture, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Generated fixture at {out_path} ({len(json.dumps(fixture))} bytes)")


if __name__ == "__main__":
    main()
