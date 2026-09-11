from __future__ import annotations

from typing import Any
from app.core.constants import SCHEMA_VERSION_RESULT
from app.core.routing import RoutingMetric
from app.core.simulator import run_simulation


def export_result(
    scenario: dict[str, Any],
    metric: RoutingMetric = "hops",
    routes: list[dict[str, Any]] | None = None,
    client_metrics: dict[str, Any] | None = None,
    summary: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Format simulation output in compliance with cosmo-A-result-1.0 schema.
    """
    if routes is None:
        sim = run_simulation(scenario, metric=metric, include_timeline=False)
        routes = sim["routes"]
        client_metrics = sim["client_metrics"]
        summary = sim["summary"]

    # Filter client_metrics to lightweight summary without large timelines for export
    clean_metrics: dict[str, Any] = {}
    if client_metrics:
        for cid, m in client_metrics.items():
            clean_metrics[cid] = {
                k: v for k, v in m.items() if k not in ("timeline", "outage_intervals")
            }

    return {
        "schema_version": SCHEMA_VERSION_RESULT,
        "effective_scenario": scenario,
        "routes": routes,
        "metrics": clean_metrics,
        "summary": summary,
    }
