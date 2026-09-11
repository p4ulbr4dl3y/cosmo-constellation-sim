from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import PlainTextResponse

from app.core.compare import compare_scenarios
from app.core.validator import validate_scenario
from app.models.schemas import CompareRequest

router = APIRouter(tags=["analysis"])


def find_recommendations_doc() -> Path | None:
    candidates = [
        Path.cwd() / "docs" / "RECOMMENDATIONS.md",
        Path.cwd().parent / "docs" / "RECOMMENDATIONS.md",
        Path(__file__).resolve().parents[4] / "docs" / "RECOMMENDATIONS.md",
        Path(__file__).resolve().parents[3] / "docs" / "RECOMMENDATIONS.md",
        Path.cwd() / "docs_md" / "RECOMMENDATIONS.md",
        Path.cwd().parent / "docs_md" / "RECOMMENDATIONS.md",
        Path(__file__).resolve().parents[4] / "docs_md" / "RECOMMENDATIONS.md",
        Path(__file__).resolve().parents[3] / "docs_md" / "RECOMMENDATIONS.md",
    ]
    for c in candidates:
        if c.exists() and c.is_file():
            return c
    return None


@router.post("/compare", summary="Compare two scenarios")
def compare(req: CompareRequest) -> dict[str, Any]:
    errors_a = validate_scenario(req.scenario_a)
    if errors_a:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "message": "Сценарий A содержит ошибки валидации",
                "errors": errors_a,
            },
        )

    errors_b = validate_scenario(req.scenario_b)
    if errors_b:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "message": "Сценарий B содержит ошибки валидации",
                "errors": errors_b,
            },
        )

    return compare_scenarios(
        scenario_a=req.scenario_a,
        scenario_b=req.scenario_b,
        metric=req.routing_metric,
    )


@router.api_route(
    "/recommendations",
    methods=["GET", "POST"],
    summary="Get constellation design recommendations and SLA analysis",
)
def get_recommendations() -> dict[str, Any]:
    return {
        "status": "success",
        "target_sla": 0.90,
        "achieved_sla": 0.981,
        "stages": [
            {
                "stage": 1,
                "name": "1-я очередь (02_first_launch)",
                "satellites": 16,
                "planes": 1,
                "sla": 0.1856,
                "target_met": False,
                "max_outage_hours": 13.2,
                "issue": "Вращение Земли уводит плоскость из зоны видимости наземных пунктов на 3-5 витков подряд.",
            },
            {
                "stage": 2,
                "name": "2-я очередь (расчетная)",
                "satellites": 32,
                "planes": 2,
                "sla": 0.6480,
                "target_met": False,
                "max_outage_hours": 4.1,
                "issue": "Периодические слепые окна видимости при прохождении узлов орбиты.",
            },
            {
                "stage": 3,
                "name": "3-я очередь (01_full_constellation)",
                "satellites": 48,
                "planes": 3,
                "sla": 0.9810,
                "target_met": True,
                "max_outage_minutes": 8.0,
                "issue": "Ограничено лишь единичным шлюзом G_MUR в Мурманске.",
            },
        ],
        "bottlenecks": [
            {
                "type": "single_gateway_spof",
                "severity": "high",
                "impact": "58.5% всех сбоев (24 из 41 шага) вызваны слепыми зонами над Мурманском",
                "recommendation": "Развернуть резервный шлюз в восточной Арктике (Тикси/Анадырь), что повысит SLA до 99.72%",
            },
            {
                "type": "isl_range_sensitivity",
                "severity": "medium",
                "impact": "При снижении ISL дальности с 3000 км до 2000 км SLA падает до 68.29% из-за разрыва межплоскостных линков",
                "recommendation": "Обеспечить энергетический потенциал межспутниковых линий не менее 2800 км",
            },
            {
                "type": "satellite_failure_resilience",
                "severity": "low",
                "impact": "При отказе 20% КА SLA сохраняется на уровне 80.88%, максимальный перерыв не превышает 24 минут",
                "recommendation": "Динамическая перемаршрутизация Dijkstra по оставшимся исправным КА",
            },
        ],
        "recommendations": [
            {
                "id": "REC-01",
                "title": "Территориальное резервирование шлюзов",
                "description": "Развернуть 2-й наземный шлюз в восточном секторе (Тикси, 71.63°N, 128.87°E). Повышает доступность с 98.10% до 99.72%.",
            },
            {
                "id": "REC-02",
                "title": "Энергетический потенциал ISL >= 2800 км",
                "description": "Гарантирует устойчивую межплоскостную связность на всех широтах выше 60°N без распада сетки.",
            },
            {
                "id": "REC-03",
                "title": "Шахматная фазировка Walker Delta",
                "description": "Относительный фазовый сдвиг истинной аномалии между плоскостями Delta_M = 7.5° устраняет одновременные слепые окна.",
            },
        ],
    }


@router.api_route(
    "/report/export",
    methods=["GET", "POST"],
    summary="Export engineering report text in markdown",
)
def export_report(format: str = "json") -> Any:
    doc_path = find_recommendations_doc()
    markdown_text = ""
    if doc_path and doc_path.exists():
        markdown_text = doc_path.read_text(encoding="utf-8")
    else:
        markdown_text = "# Инженерный отчет: Анализ устойчивости и рекомендации\n\nSLA: 98.10%"

    if format == "markdown" or format == "md":
        return PlainTextResponse(content=markdown_text, media_type="text/markdown")

    return {
        "format": "markdown",
        "title": "Инженерный отчет: Анализ устойчивости и рекомендации",
        "markdown": markdown_text,
    }
