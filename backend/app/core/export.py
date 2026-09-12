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
    Формирование итогового отчета моделирования по схеме cosmo-A-result-1.0.

    Параметры:
    - scenario: параметры исходного сценария моделирования;
    - metric: критерий оптимизации маршрута ('hops' или 'distance');
    - routes: рассчитанные маршруты на каждом временном шаге;
    - client_metrics: поклиентские показатели качества связи;
    - summary: агрегированные показатели доступности группировки.

    Возвращает словарь результата, готовый для сериализации в JSON.
    """
    if routes is None:
        sim = run_simulation(scenario, metric=metric, include_timeline=False)
        routes = sim["routes"]
        client_metrics = sim["client_metrics"]
        summary = sim["summary"]

    # Удаление детальных временных шкал для компактного экспорта
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
