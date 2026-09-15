use axum::{
    extract::{Path, Query},
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use cosmo_core::{
    compare_scenarios, export_result, run_simulation, snapshot, validate_scenario,
    RoutingMetric, Scenario, EARTH_RADIUS_KM,
};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::net::SocketAddr;
use tower_http::cors::CorsLayer;

#[derive(Serialize)]
struct HealthResponse {
    status: &'static str,
    earth_radius_km: f64,
    engine: &'static str,
}

async fn health_check() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok",
        earth_radius_km: EARTH_RADIUS_KM,
        engine: "Rust / Axum + cosmo-core",
    })
}

#[derive(Deserialize)]
struct SimulateQuery {
    #[serde(default = "default_metric")]
    metric: String,
    #[serde(default = "default_true")]
    include_timeline: bool,
}

fn default_metric() -> String {
    "hops".to_string()
}
fn default_true() -> bool {
    true
}

async fn simulate_endpoint(
    Query(q): Query<SimulateQuery>,
    Json(scenario): Json<Scenario>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let errors = validate_scenario(&scenario);
    if !errors.is_empty() {
        return Err((
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(json!({ "detail": errors })),
        ));
    }

    let metric = match q.metric.as_str() {
        "distance" => RoutingMetric::Distance,
        _ => RoutingMetric::Hops,
    };

    let result = run_simulation(&scenario, metric, q.include_timeline);
    let val = serde_json::to_value(result).unwrap();
    Ok(Json(val))
}

#[derive(Deserialize)]
struct SnapshotQuery {
    #[serde(default)]
    t_s: f64,
}

async fn snapshot_endpoint(
    Query(q): Query<SnapshotQuery>,
    Json(scenario): Json<Scenario>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let result = snapshot(&scenario, q.t_s, false);
    let val = serde_json::to_value(result).unwrap();
    Ok(Json(val))
}

async fn validate_endpoint(Json(scenario): Json<Scenario>) -> Json<Value> {
    let errors = validate_scenario(&scenario);
    Json(json!({
        "valid": errors.is_empty(),
        "errors": errors
    }))
}

#[derive(Deserialize)]
struct CompareRequest {
    scenario_a: Scenario,
    scenario_b: Scenario,
    #[serde(default = "default_metric")]
    metric: String,
}

async fn compare_endpoint(Json(req): Json<CompareRequest>) -> Json<Value> {
    let metric = match req.metric.as_str() {
        "distance" => RoutingMetric::Distance,
        _ => RoutingMetric::Hops,
    };
    let result = compare_scenarios(&req.scenario_a, &req.scenario_b, metric);
    let val = serde_json::to_value(result).unwrap();
    Json(val)
}

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/health", get(health_check))
        .route("/api/v1/health", get(health_check))
        .route("/api/v1/simulate", post(simulate_endpoint))
        .route("/api/v1/snapshot", post(snapshot_endpoint))
        .route("/api/v1/validate", post(validate_endpoint))
        .route("/api/v1/compare", post(compare_endpoint))
        .layer(CorsLayer::permissive());

    let addr = SocketAddr::from(([127, 0, 0, 1], 8000));
    println!("Rust Axum server active at http://{}", addr);
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
