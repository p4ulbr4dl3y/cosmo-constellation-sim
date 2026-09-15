use axum::{extract::Query, http::StatusCode, response::IntoResponse, Json};
use cosmo_core::{
    compare_scenarios, export_result, validate_scenario, RoutingMetric,
};
use serde_json::{json, Value};
use std::fs;

use crate::config::find_docs_dir;
use crate::dto::{CompareRequest, ExportRequest, ReportQuery};

/// Эндпоинт проверки корректности физических параметров и структуры сценария.
pub async fn validate_endpoint(Json(body): Json<Value>) -> Json<Value> {
    let errors = cosmo_core::validate_scenario_value(&body);
    Json(json!({
        "valid": errors.is_empty(),
        "errors": errors
    }))
}

/// Эндпоинт экспорта результатов моделирования в стандарте cosmo-A-result-1.0.
pub async fn export_endpoint(
    Json(req): Json<ExportRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let errors = validate_scenario(&req.scenario);
    if !errors.is_empty() {
        return Err((
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(json!({
                "message": "Сценарий содержит ошибки валидации",
                "errors": errors
            })),
        ));
    }

    let metric = match req.routing_metric.as_str() {
        "distance" => RoutingMetric::Distance,
        _ => RoutingMetric::Hops,
    };

    let result = export_result(&req.scenario, metric);
    let val = serde_json::to_value(result).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "message": e.to_string() })),
        )
    })?;
    Ok(Json(val))
}

/// Эндпоинт сравнения двух сценариев (A и B) по параметрам и связности.
pub async fn compare_endpoint(
    Json(req): Json<CompareRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let errors_a = validate_scenario(&req.scenario_a);
    let errors_b = validate_scenario(&req.scenario_b);
    let mut all_errors = errors_a;
    all_errors.extend(errors_b);

    if !all_errors.is_empty() {
        return Err((
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(json!({
                "message": "Сценарий содержит ошибки валидации",
                "errors": all_errors
            })),
        ));
    }

    let metric = match req.routing_metric.as_str() {
        "distance" => RoutingMetric::Distance,
        _ => RoutingMetric::Hops,
    };
    let result = compare_scenarios(&req.scenario_a, &req.scenario_b, metric);
    let val = serde_json::to_value(result).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "message": e.to_string() })),
        )
    })?;
    Ok(Json(val))
}

/// Эндпоинт получения инженерных рекомендаций и анализа узких мест.
pub async fn recommendations_endpoint() -> Json<Value> {
    Json(json!({
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
                "target_met": false,
                "max_outage_hours": 13.2,
                "issue": "Вращение Земли уводит плоскость из зоны видимости наземных пунктов на 3-5 витков подряд."
            },
            {
                "stage": 2,
                "name": "2-я очередь (расчетная)",
                "satellites": 32,
                "planes": 2,
                "sla": 0.6480,
                "target_met": false,
                "max_outage_hours": 4.1,
                "issue": "Периодические слепые окна видимости при прохождении узлов орбиты."
            },
            {
                "stage": 3,
                "name": "3-я очередь (01_full_constellation)",
                "satellites": 48,
                "planes": 3,
                "sla": 0.9810,
                "target_met": true,
                "max_outage_minutes": 8.0,
                "issue": "Ограничено лишь единичным шлюзом G_MUR в Мурманске."
            }
        ],
        "bottlenecks": [
            {
                "type": "single_gateway_spof",
                "severity": "high",
                "impact": "58.5% всех сбоев (24 из 41 шага) вызваны слепыми зонами над Мурманском",
                "recommendation": "Развернуть резервный шлюз в восточной Арктике (Тикси/Анадырь), что повысит SLA до 99.72%"
            },
            {
                "type": "isl_range_sensitivity",
                "severity": "medium",
                "impact": "При снижении ISL дальности с 3000 км до 2000 км SLA падает до 68.29% из-за разрыва межплоскостных линков",
                "recommendation": "Обеспечить энергетический потенциал межспутниковых линий не менее 2800 км"
            },
            {
                "type": "satellite_failure_resilience",
                "severity": "low",
                "impact": "При отказе 20% КА SLA сохраняется на уровне 80.88%, максимальный перерыв не превышает 24 минут",
                "recommendation": "Динамическая перемаршрутизация Dijkstra по оставшимся исправным КА"
            }
        ],
        "recommendations": [
            {
                "id": "REC-01",
                "title": "Территориальное резервирование шлюзов",
                "description": "Развернуть 2-й наземный шлюз в восточном секторе (Тикси, 71.63°N, 128.87°E). Повышает доступность с 98.10% до 99.72%."
            },
            {
                "id": "REC-02",
                "title": "Энергетический потенциал ISL >= 2800 км",
                "description": "Гарантирует устойчивую межплоскостную связность на всех широтах выше 60°N без распада сетки."
            },
            {
                "id": "REC-03",
                "title": "Шахматная фазировка Walker Delta",
                "description": "Относительный фазовый сдвиг истинной аномалии между плоскостями Delta_M = 7.5° устраняет одновременные слепые окна."
            }
        ]
    }))
}

/// Эндпоинт экспорта текста инженерного отчета.
pub async fn report_export_endpoint(Query(q): Query<ReportQuery>) -> impl IntoResponse {
    let docs_dir = find_docs_dir();
    let rec_file = docs_dir.join("RECOMMENDATIONS.md");

    let markdown_text = if rec_file.exists() && rec_file.is_file() {
        fs::read_to_string(&rec_file).unwrap_or_else(|_| {
            "# Инженерный отчет: Анализ устойчивости и рекомендации\n\nSLA: 98.10%".to_string()
        })
    } else {
        "# Инженерный отчет: Анализ устойчивости и рекомендации\n\nSLA: 98.10%".to_string()
    };

    let fmt = q.format.unwrap_or_else(|| "json".to_string());
    if fmt == "markdown" || fmt == "md" {
        (
            StatusCode::OK,
            [("content-type", "text/markdown; charset=utf-8")],
            markdown_text,
        )
            .into_response()
    } else {
        Json(json!({
            "format": "markdown",
            "title": "Инженерный отчет: Анализ устойчивости и рекомендации",
            "markdown": markdown_text,
        }))
        .into_response()
    }
}
