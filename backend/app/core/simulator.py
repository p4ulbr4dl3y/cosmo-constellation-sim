from __future__ import annotations

from typing import Any
from app.core.geometry import snapshot
from app.core.routing import (
    RoutingMetric,
    build_adjacency,
    classify_failure,
    find_route,
)


def run_simulation(
    scenario: dict[str, Any],
    metric: RoutingMetric = "hops",
    include_timeline: bool = True,
) -> dict[str, Any]:
    """
    Run full time-horizon simulation on scenario.
    Returns complete metrics, outage timelines, and failure breakdown.
    """
    env = scenario["environment"]
    step_s = int(env["step_s"])
    horizon_s = int(env["horizon_s"])
    target_avail = float(env.get("target_availability", 0.9))

    clients = [g["id"] for g in scenario.get("ground_sites", []) if g.get("role") == "client"]
    all_clients_set = set(clients)
    gateways = [g["id"] for g in scenario.get("ground_sites", []) if g.get("role") == "gateway"]
    all_gw_set = set(gateways)
    gw_outages = scenario.get("gateway_outages", [])

    time_steps = list(range(0, horizon_s, step_s))
    total_steps = len(time_steps)

    # Per-client accumulators
    client_data: dict[str, dict[str, Any]] = {
        cid: {
            "steps_with_path": 0,
            "steps_with_vis": 0,
            "current_outage_steps": 0,
            "max_outage_steps": 0,
            "hops_list": [],
            "distance_list": [],
            "failure_counts": {
                "no_client_satellite": 0,
                "gateway_offline": 0,
                "no_gateway_satellite": 0,
                "isl_disconnected": 0,
            },
            "timeline": [],
            "current_outage_start": None,
            "current_outage_reason": None,
            "outage_intervals": [],
        }
        for cid in clients
    }

    all_routes: list[dict[str, Any]] = []

    for t_s in time_steps:
        snap = snapshot(scenario, t_s, fast_edges_only=True)
        adj = build_adjacency(snap["edges"])

        # Online gateways at this time step
        cur_gw_outages = {f["gateway_id"] for f in gw_outages if f["start_s"] <= t_s < f["end_s"]}
        online_gateways = {gid for gid in all_gw_set if gid not in cur_gw_outages}

        # Any active satellite visible to any online gateway?
        gw_has_sat = False
        for gid in online_gateways:
            if any(nxt not in all_gw_set for nxt, _ in adj.get(gid, [])):
                gw_has_sat = True
                break

        for cid in clients:
            cdata = client_data[cid]
            client_visible_sats = [
                nxt
                for nxt, _ in adj.get(cid, [])
                if nxt not in all_clients_set and nxt not in all_gw_set
            ]
            has_client_sat = len(client_visible_sats) > 0

            if has_client_sat:
                cdata["steps_with_vis"] += 1

            path, total_dist = find_route(
                adj=adj,
                client_id=cid,
                online_gateways=online_gateways,
                all_clients=all_clients_set,
                metric=metric,
            )

            all_routes.append(
                {
                    "t_s": t_s,
                    "client_id": cid,
                    "path": path,
                }
            )

            has_path = len(path) > 0

            if has_path:
                cdata["steps_with_path"] += 1
                hops = len(path) - 1
                cdata["hops_list"].append(hops)
                cdata["distance_list"].append(total_dist)

                # Close ongoing outage interval if one was active
                if cdata["current_outage_steps"] > 0:
                    outage_dur = cdata["current_outage_steps"] * step_s
                    cdata["outage_intervals"].append(
                        {
                            "start_s": cdata["current_outage_start"],
                            "end_s": t_s,
                            "duration_s": outage_dur,
                            "reason": cdata["current_outage_reason"],
                        }
                    )
                    cdata["current_outage_steps"] = 0
                    cdata["current_outage_start"] = None
                    cdata["current_outage_reason"] = None

                if include_timeline:
                    cdata["timeline"].append(
                        {
                            "t_s": t_s,
                            "status": "ok",
                            "has_route": True,
                            "has_visibility": has_client_sat,
                            "hops": hops,
                            "path": path,
                            "distance_km": round(total_dist, 2),
                            "failure_code": None,
                            "failure_reason": None,
                        }
                    )
            else:
                fail_code, fail_desc = classify_failure(
                    has_client_satellite=has_client_sat,
                    online_gateways_count=len(online_gateways),
                    has_gateway_satellite=gw_has_sat,
                )
                cdata["failure_counts"][fail_code] += 1

                if cdata["current_outage_steps"] == 0:
                    cdata["current_outage_start"] = t_s
                    cdata["current_outage_reason"] = fail_code

                cdata["current_outage_steps"] += 1
                if cdata["current_outage_steps"] > cdata["max_outage_steps"]:
                    cdata["max_outage_steps"] = cdata["current_outage_steps"]

                if include_timeline:
                    cdata["timeline"].append(
                        {
                            "t_s": t_s,
                            "status": "outage",
                            "has_route": False,
                            "has_visibility": has_client_sat,
                            "hops": 0,
                            "path": [],
                            "distance_km": 0.0,
                            "failure_code": fail_code,
                            "failure_reason": fail_desc,
                        }
                    )

    # Close any trailing outage interval at horizon_s
    for cid in clients:
        cdata = client_data[cid]
        if cdata["current_outage_steps"] > 0:
            outage_dur = cdata["current_outage_steps"] * step_s
            cdata["outage_intervals"].append(
                {
                    "start_s": cdata["current_outage_start"],
                    "end_s": horizon_s,
                    "duration_s": outage_dur,
                    "reason": cdata["current_outage_reason"],
                }
            )

    # Format final metrics
    client_metrics: dict[str, Any] = {}
    total_avail_pct = 0.0
    min_avail_pct = 100.0

    for cid in clients:
        cdata = client_data[cid]
        avail_ratio = cdata["steps_with_path"] / total_steps if total_steps > 0 else 0.0
        vis_ratio = cdata["steps_with_vis"] / total_steps if total_steps > 0 else 0.0
        avail_pct = avail_ratio * 100.0
        vis_pct = vis_ratio * 100.0

        total_avail_pct += avail_pct
        min_avail_pct = min(min_avail_pct, avail_pct)

        max_outage_s = cdata["max_outage_steps"] * step_s
        total_outage_s = (total_steps - cdata["steps_with_path"]) * step_s

        hops = cdata["hops_list"]
        mean_hops = float(sum(hops) / len(hops)) if hops else None
        max_hops = max(hops) if hops else None
        min_hops = min(hops) if hops else None

        dists = cdata["distance_list"]
        mean_dist = float(sum(dists) / len(dists)) if dists else None

        client_metrics[cid] = {
            "client_id": cid,
            "availability_pct": round(avail_pct, 2),
            "availability_ratio": round(avail_ratio, 4),
            "visibility_pct": round(vis_pct, 2),
            "visibility_ratio": round(vis_ratio, 4),
            "max_outage_s": max_outage_s,
            "total_outage_s": total_outage_s,
            "mean_hops": round(mean_hops, 2) if mean_hops is not None else None,
            "max_hops": max_hops,
            "min_hops": min_hops,
            "mean_distance_km": round(mean_dist, 2) if mean_dist is not None else None,
            "meets_target": avail_ratio >= target_avail,
            "target_availability": target_avail,
            "failure_breakdown": cdata["failure_counts"],
            "outage_intervals": cdata["outage_intervals"],
            "timeline": cdata["timeline"] if include_timeline else [],
        }

    avg_avail = round(total_avail_pct / len(clients), 2) if clients else 0.0

    return {
        "scenario_meta": scenario.get("meta", {}),
        "total_steps": total_steps,
        "step_s": step_s,
        "horizon_s": horizon_s,
        "target_availability": target_avail,
        "summary": {
            "average_availability_pct": avg_avail,
            "min_availability_pct": round(min_avail_pct, 2) if clients else 0.0,
            "all_meet_target": all(m["meets_target"] for m in client_metrics.values()),
        },
        "client_metrics": client_metrics,
        "routes": all_routes,
    }


simulate_scenario = run_simulation

__all__ = ["run_simulation", "simulate_scenario"]
