use axum::{extract::Query, http::StatusCode, Json};
use cosmo_core::{
    build_adjacency, classify_failure, find_route, ground_position, run_simulation, snapshot,
    validate_scenario, RoutingMetric,
};
use serde_json::{json, Value};
use std::collections::HashSet;

use crate::dto::{
    default_metric, SimulateBody, SimulateQuery, SnapshotBody, SnapshotQuery,
};

/// Эндпоинт для проведения полного моделирования доступности сети по временному горизонту.
pub async fn simulate_endpoint(
    Query(q): Query<SimulateQuery>,
    Json(body): Json<SimulateBody>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let (scenario, metric_str, include_timeline) = match body {
        SimulateBody::Request(req) => (
            req.scenario,
            q.metric.unwrap_or(req.routing_metric),
            q.include_timeline.unwrap_or(req.include_timeline),
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
    let val = serde_json::to_value(result).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "message": e.to_string() })),
        )
    })?;
    Ok(Json(val))
}

/// Эндпоинт вычисления мгновенного состояния орбит, графа и маршрутизации клиентов.
pub async fn snapshot_endpoint(
    Query(q): Query<SnapshotQuery>,
    Json(body): Json<SnapshotBody>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let (scenario, t_s, metric_str) = match body {
        SnapshotBody::Request(req) => (
            req.scenario,
            q.t_s.unwrap_or(req.t_s),
            q.metric.unwrap_or(req.routing_metric),
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
