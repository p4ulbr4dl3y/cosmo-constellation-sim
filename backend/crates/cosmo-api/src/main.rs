use axum::{
    extract::{Path, Query},
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use cosmo_core::{
    build_adjacency, classify_failure, compare_scenarios, export_result, find_route,
    ground_position, run_simulation, snapshot, validate_scenario,
    RoutingMetric, Scenario, EARTH_RADIUS_KM,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::HashSet,
    fs,
    net::SocketAddr,
    path::{Path as StdPath, PathBuf},
};
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

fn default_metric() -> String {
    "hops".to_string()
}
fn default_true() -> bool {
    true
}

#[derive(Deserialize)]
#[serde(untagged)]
enum SimulateBody {
    Request {
        scenario: Scenario,
        #[serde(default = "default_metric")]
        routing_metric: String,
        #[serde(default = "default_true")]
        include_timeline: bool,
    },
    Direct(Scenario),
}

#[derive(Deserialize)]
struct SimulateQuery {
    metric: Option<String>,
    include_timeline: Option<bool>,
}

async fn simulate_endpoint(
    Query(q): Query<SimulateQuery>,
    Json(body): Json<SimulateBody>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let (scenario, metric_str, include_timeline) = match body {
        SimulateBody::Request {
            scenario,
            routing_metric,
            include_timeline,
        } => (
            scenario,
            q.metric.unwrap_or(routing_metric),
            q.include_timeline.unwrap_or(include_timeline),
        ),
        SimulateBody::Direct(scenario) => (
            scenario,
            q.metric.unwrap_or_else(default_metric),
            q.include_timeline.unwrap_or(true),
        ),
    };

    let errors = validate_scenario(&scenario);
    if !errors.is_empty() {
        return Err((
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(json!({
                "message": "Сценарий содержит ошибки валидации",
                "errors": errors
            })),
        ));
    }

    let metric = match metric_str.as_str() {
        "distance" => RoutingMetric::Distance,
        _ => RoutingMetric::Hops,
    };

    let result = run_simulation(&scenario, metric, include_timeline);
    let val = serde_json::to_value(result).unwrap();
    Ok(Json(val))
}

#[derive(Deserialize)]
#[serde(untagged)]
enum SnapshotBody {
    Request {
        scenario: Scenario,
        #[serde(default)]
        t_s: f64,
        #[serde(default = "default_metric")]
        routing_metric: String,
    },
    Direct(Scenario),
}

#[derive(Deserialize)]
struct SnapshotQuery {
    t_s: Option<f64>,
    metric: Option<String>,
}

async fn snapshot_endpoint(
    Query(q): Query<SnapshotQuery>,
    Json(body): Json<SnapshotBody>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let (scenario, t_s, metric_str) = match body {
        SnapshotBody::Request {
            scenario,
            t_s,
            routing_metric,
        } => (
            scenario,
            q.t_s.unwrap_or(t_s),
            q.metric.unwrap_or(routing_metric),
        ),
        SnapshotBody::Direct(scenario) => (
            scenario,
            q.t_s.unwrap_or(0.0),
            q.metric.unwrap_or_else(default_metric),
        ),
    };

    let errors = validate_scenario(&scenario);
    if !errors.is_empty() {
        return Err((
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(json!({
                "message": "Сценарий содержит ошибки валидации",
                "errors": errors
            })),
        ));
    }

    let metric = match metric_str.as_str() {
        "distance" => RoutingMetric::Distance,
        _ => RoutingMetric::Hops,
    };

    let snap = snapshot(&scenario, t_s, false);
    let adj = build_adjacency(&snap.edges);

    let ground = &scenario.ground_sites;
    let clients: Vec<String> = ground
        .iter()
        .filter(|g| g.role == "client")
        .map(|g| g.id.clone())
        .collect();
    let all_clients_set: HashSet<String> = clients.iter().cloned().collect();
    let gateways: Vec<String> = ground
        .iter()
        .filter(|g| g.role == "gateway")
        .map(|g| g.id.clone())
        .collect();
    let all_gw_set: HashSet<String> = gateways.iter().cloned().collect();
    let gw_outages = &scenario.gateway_outages;

    let cur_gw_outages: HashSet<String> = gw_outages
        .iter()
        .filter(|f| (f.start_s as f64) <= t_s && t_s < (f.end_s as f64))
        .map(|f| f.gateway_id.clone())
        .collect();
    let online_gateways: HashSet<String> = all_gw_set
        .iter()
        .filter(|gid| !cur_gw_outages.contains(*gid))
        .cloned()
        .collect();

    let mut gw_has_sat = false;
    for gid in &online_gateways {
        if let Some(neighbors) = adj.get(gid) {
            if neighbors.iter().any(|(nxt, _)| !all_gw_set.contains(nxt)) {
                gw_has_sat = true;
                break;
            }
        }
    }

    let mut ground_sites_out = Vec::new();
    for g in ground {
        let gp = ground_position(g);
        let is_gw = g.role == "gateway";
        let is_online = if is_gw {
            !cur_gw_outages.contains(&g.id)
        } else {
            true
        };
        ground_sites_out.push(json!({
            "id": g.id,
            "name": g.name.clone().unwrap_or_else(|| g.id.clone()),
            "role": g.role,
            "lat_deg": g.lat_deg,
            "lon_deg": g.lon_deg,
            "x_km": (gp[0] * 100.0).round() / 100.0,
            "y_km": (gp[1] * 100.0).round() / 100.0,
            "z_km": (gp[2] * 100.0).round() / 100.0,
            "online": is_online
        }));
    }

    let mut client_routes = serde_json::Map::new();
    let mut clients_connected = 0;

    for cid in &clients {
        let client_visible_sats: Vec<String> = adj
            .get(cid)
            .map(|list| {
                list.iter()
                    .map(|(nxt, _)| nxt.clone())
                    .filter(|nxt| !all_clients_set.contains(nxt) && !all_gw_set.contains(nxt))
                    .collect()
            })
            .unwrap_or_default();
        let has_client_sat = !client_visible_sats.is_empty();

        let (path, total_dist) = find_route(&adj, cid, &online_gateways, &all_clients_set, metric);
        let has_path = !path.is_empty();

        if has_path {
            clients_connected += 1;
            client_routes.insert(
                cid.clone(),
                json!({
                    "client_id": cid,
                    "status": "ok",
                    "path": path,
                    "hops": path.len() - 1,
                    "distance_km": (total_dist * 100.0).round() / 100.0,
                    "failure_code": Value::Null,
                    "failure_reason": Value::Null,
                }),
            );
        } else {
            let (fail_code, fail_desc) = classify_failure(
                has_client_sat,
                online_gateways.len(),
                gw_has_sat,
            );
            client_routes.insert(
                cid.clone(),
                json!({
                    "client_id": cid,
                    "status": "outage",
                    "path": vec![] as Vec<String>,
                    "hops": 0,
                    "distance_km": 0.0,
                    "failure_code": fail_code,
                    "failure_reason": fail_desc,
                }),
            );
        }
    }

    let sat_ids_set: HashSet<String> = snap.satellites.iter().map(|s| s.id.clone()).collect();
    let mut typed_edges = Vec::new();
    for edge in &snap.edges {
        let u_str = &edge.0;
        let v_str = &edge.1;
        let dist = edge.2;
        let is_isl = sat_ids_set.contains(u_str) && sat_ids_set.contains(v_str);
        typed_edges.push(json!({
            "source": u_str,
            "target": v_str,
            "distance_km": (dist * 100.0).round() / 100.0,
            "type": if is_isl { "isl" } else { "ground" }
        }));
    }

    let active_sats = snap.satellites.iter().filter(|s| s.active).count();
    let failed_sats = snap.satellites.iter().filter(|s| s.failed).count();

    let response = json!({
        "t_s": t_s,
        "satellites": snap.satellites,
        "ground_sites": ground_sites_out,
        "edges": typed_edges,
        "elevation_deg": snap.elevation_deg,
        "client_routes": client_routes,
        "summary": {
            "total_satellites": snap.satellites.len(),
            "active_satellites": active_sats,
            "failed_satellites": failed_sats,
            "isl_links_count": typed_edges.iter().filter(|e| e["type"] == "isl").count(),
            "ground_links_count": typed_edges.iter().filter(|e| e["type"] == "ground").count(),
            "clients_total": clients.len(),
            "clients_connected": clients_connected,
            "clients_outage": clients.len() - clients_connected,
        }
    });

    Ok(Json(response))
}

async fn validate_endpoint(Json(body): Json<Value>) -> Json<Value> {
    let errors = cosmo_core::validate_scenario_value(&body);
    Json(json!({
        "valid": errors.is_empty(),
        "errors": errors
    }))
}

#[derive(Deserialize)]
struct ExportRequest {
    scenario: Scenario,
    #[serde(default = "default_metric")]
    routing_metric: String,
}

async fn export_endpoint(
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
    let val = serde_json::to_value(result).unwrap();
    Ok(Json(val))
}

#[derive(Deserialize)]
struct CompareRequest {
    scenario_a: Scenario,
    scenario_b: Scenario,
    #[serde(default = "default_metric")]
    routing_metric: String,
}

async fn compare_endpoint(
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
    let val = serde_json::to_value(result).unwrap();
    Ok(Json(val))
}

fn find_data_dir() -> PathBuf {
    let candidates = vec![
        PathBuf::from("data"),
        PathBuf::from("../data"),
        PathBuf::from("../../data"),
    ];
    for c in candidates {
        if c.exists() && c.is_dir() {
            return c;
        }
    }
    PathBuf::from("data")
}

async fn get_presets_endpoint() -> Json<Value> {
    let data_dir = find_data_dir();
    let mut summaries = Vec::new();

    if let Ok(entries) = fs::read_dir(&data_dir) {
        let mut paths: Vec<_> = entries
            .filter_map(|e| e.ok())
            .map(|e| e.path())
            .filter(|p| p.extension().map_or(false, |ext| ext == "json"))
            .collect();
        paths.sort();

        for p in paths {
            if let Ok(content_str) = fs::read_to_string(&p) {
                if let Ok(scenario) = serde_json::from_str::<Scenario>(&content_str) {
                    if scenario.schema_version.as_deref() != Some("cosmo-A-1.0") {
                        continue;
                    }
                    let client_count = scenario
                        .ground_sites
                        .iter()
                        .filter(|g| g.role == "client")
                        .count();
                    let gateway_count = scenario
                        .ground_sites
                        .iter()
                        .filter(|g| g.role == "gateway")
                        .count();
                    let filename = p
                        .file_name()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_string();
                    let stem = p
                        .file_stem()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_string();

                    let meta_id = scenario
                        .meta
                        .as_ref()
                        .and_then(|m| m.get("id"))
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string())
                        .unwrap_or(stem);

                    let meta_title = scenario
                        .meta
                        .as_ref()
                        .and_then(|m| m.get("title"))
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string())
                        .unwrap_or_else(|| filename.clone());

                    summaries.push(json!({
                        "id": meta_id,
                        "title": meta_title,
                        "filename": filename,
                        "satellite_count": scenario.design.satellites.len(),
                        "planes_count": scenario.design.planes.len(),
                        "client_count": client_count,
                        "gateway_count": gateway_count,
                        "horizon_s": scenario.environment.horizon_s,
                        "step_s": scenario.environment.step_s,
                        "launch_stage": scenario.design.launch_stage,
                        "isl_range_km": scenario.environment.isl_range_km
                    }));
                }
            }
        }
    }

    Json(json!(summaries))
}

async fn get_preset_endpoint(
    Path(name): Path<String>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let data_dir = find_data_dir();
    let file_stem = StdPath::new(&name)
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or(&name);
    let filename = if file_stem.ends_with(".json") {
        file_stem.to_string()
    } else {
        format!("{}.json", file_stem)
    };
    let preset_path = data_dir.join(&filename);

    let canonical_data = data_dir.canonicalize().unwrap_or(data_dir.clone());
    let is_safe = preset_path
        .canonicalize()
        .map(|p| p.starts_with(&canonical_data))
        .unwrap_or(false);

    if !preset_path.exists() || !is_safe {
        return Err((
            StatusCode::NOT_FOUND,
            Json(json!({
                "message": format!("Сценарий '{}' не найден в каталоге пресетов.", name)
            })),
        ));
    }

    match fs::read_to_string(&preset_path) {
        Ok(content) => match serde_json::from_str::<Value>(&content) {
            Ok(json_val) => Ok(Json(json_val)),
            Err(e) => Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({
                    "message": format!("Ошибка парсинга сценария: {}", e)
                })),
            )),
        },
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({
                "message": format!("Ошибка чтения файла сценария: {}", e)
            })),
        )),
    }
}

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/health", get(health_check))
        .route("/api/v1/health", get(health_check))
        .route("/api/v1/simulate", post(simulate_endpoint))
        .route("/api/v1/snapshot", post(snapshot_endpoint))
        .route("/api/v1/validate", post(validate_endpoint))
        .route("/api/v1/export", post(export_endpoint))
        .route("/api/v1/compare", post(compare_endpoint))
        .route("/api/v1/presets", get(get_presets_endpoint))
        .route("/api/v1/presets/:name", get(get_preset_endpoint))
        .layer(CorsLayer::permissive());

    let addr = SocketAddr::from(([127, 0, 0, 1], 8000));
    println!("Rust Axum server active at http://{}", addr);
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
