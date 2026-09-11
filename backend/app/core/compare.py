from __future__ import annotations

from typing import Any
from app.core.routing import RoutingMetric
from app.core.simulator import run_simulation


def diff_scenario_parameters(a: dict[str, Any], b: dict[str, Any]) -> dict[str, Any]:
    """Find differences in environment and design between scenario A and B."""
    diffs: list[dict[str, Any]] = []

    # Environment
    env_a = a.get("environment", {})
    env_b = b.get("environment", {})
    for k in sorted(set(env_a.keys()) | set(env_b.keys())):
        va = env_a.get(k)
        vb = env_b.get(k)
        if va != vb:
            diffs.append(
                {
                    "field": f"environment.{k}",
                    "value_a": va,
                    "value_b": vb,
                }
            )

    # Design launch stage
    des_a = a.get("design", {})
    des_b = b.get("design", {})
    if des_a.get("launch_stage") != des_b.get("launch_stage"):
        diffs.append(
            {
                "field": "design.launch_stage",
                "value_a": des_a.get("launch_stage"),
                "value_b": des_b.get("launch_stage"),
            }
        )

    # Planes count and parameters
    planes_a = {p["id"]: p for p in des_a.get("planes", [])}
    planes_b = {p["id"]: p for p in des_b.get("planes", [])}
    for pid in sorted(set(planes_a.keys()) | set(planes_b.keys())):
        pa = planes_a.get(pid)
        pb = planes_b.get(pid)
        if pa != pb:
            diffs.append(
                {
                    "field": f"design.planes[{pid}]",
                    "value_a": pa,
                    "value_b": pb,
                }
            )

    # Satellites count
    sats_a = len(des_a.get("satellites", []))
    sats_b = len(des_b.get("satellites", []))
    if sats_a != sats_b:
        diffs.append(
            {
                "field": "design.satellites_count",
                "value_a": sats_a,
                "value_b": sats_b,
            }
        )

    # Failures count
    fails_a = len(a.get("failures", []))
    fails_b = len(b.get("failures", []))
    if fails_a != fails_b:
        diffs.append(
            {
                "field": "failures_count",
                "value_a": fails_a,
                "value_b": fails_b,
            }
        )

    # Gateway outages count
    gw_a = len(a.get("gateway_outages", []))
    gw_b = len(b.get("gateway_outages", []))
    if gw_a != gw_b:
        diffs.append(
            {
                "field": "gateway_outages_count",
                "value_a": gw_a,
                "value_b": gw_b,
            }
        )

    return {"differences": diffs}


def compare_scenarios(
    scenario_a: dict[str, Any],
    scenario_b: dict[str, Any],
    metric: RoutingMetric = "hops",
) -> dict[str, Any]:
    """Run simulations on A and B and provide comparative delta analysis."""
    sim_a = run_simulation(scenario_a, metric=metric, include_timeline=False)
    sim_b = run_simulation(scenario_b, metric=metric, include_timeline=False)

    param_diff = diff_scenario_parameters(scenario_a, scenario_b)

    clients_a = sim_a["client_metrics"]
    clients_b = sim_b["client_metrics"]
    common_clients = sorted(set(clients_a.keys()) & set(clients_b.keys()))

    client_deltas: dict[str, Any] = {}
    for cid in common_clients:
        ma = clients_a[cid]
        mb = clients_b[cid]

        delta_avail = round(mb["availability_pct"] - ma["availability_pct"], 2)
        delta_vis = round(mb["visibility_pct"] - ma["visibility_pct"], 2)
        delta_outage = mb["max_outage_s"] - ma["max_outage_s"]

        hops_a = ma["mean_hops"]
        hops_b = mb["mean_hops"]
        delta_hops = (
            round(hops_b - hops_a, 2) if (hops_a is not None and hops_b is not None) else None
        )

        client_deltas[cid] = {
            "client_id": cid,
            "metrics_a": ma,
            "metrics_b": mb,
            "delta_availability_pct": delta_avail,
            "delta_visibility_pct": delta_vis,
            "delta_max_outage_s": delta_outage,
            "delta_mean_hops": delta_hops,
            "status_change": (
                "improved"
                if delta_avail > 0.5
                else "degraded"
                if delta_avail < -0.5
                else "unchanged"
            ),
        }

    sum_a = sim_a["summary"]
    sum_b = sim_b["summary"]
    avg_delta = round(sum_b["average_availability_pct"] - sum_a["average_availability_pct"], 2)
    min_delta = round(sum_b["min_availability_pct"] - sum_a["min_availability_pct"], 2)

    # Engineering recommendation
    notes = []
    if avg_delta > 0:
        notes.append(f"Вариант B превосходит вариант A по средней доступности на +{avg_delta}%.")
    elif avg_delta < 0:
        notes.append(f"Вариант B уступает варианту A по средней доступности на {avg_delta}%.")
    else:
        notes.append("Средняя доступность вариантов идентична.")

    if sum_b["all_meet_target"] and not sum_a["all_meet_target"]:
        notes.append("В варианте B все пункты вышли на целевой уровень доступности (>= 90%).")
    elif not sum_b["all_meet_target"] and sum_a["all_meet_target"]:
        notes.append("В варианте B утрачено соответствие целевому уровню доступности (>= 90%).")

    recommendation = " ".join(notes)

    return {
        "parameter_differences": param_diff["differences"],
        "summary": {
            "scenario_a": sum_a,
            "scenario_b": sum_b,
            "delta_average_availability_pct": avg_delta,
            "delta_min_availability_pct": min_delta,
            "recommendation": recommendation,
        },
        "client_comparison": client_deltas,
    }
