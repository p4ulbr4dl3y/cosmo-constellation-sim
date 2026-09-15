mod config;
mod dto;
mod handlers;

use axum::{
    routing::{get, post},
    Router,
};
use handlers::{
    analysis::{
        compare_endpoint, export_endpoint, recommendations_endpoint, report_export_endpoint,
        validate_endpoint,
    },
    health::health_check,
    presets::{get_preset_endpoint, get_presets_endpoint},
    simulation::{simulate_endpoint, snapshot_endpoint},
};
#[cfg(not(test))]
use std::net::SocketAddr;
use tower_http::cors::CorsLayer;

/// Создание и настройка роутера Axum с CORS middleware и префиксами маршрутов.
pub fn create_app() -> Router {
    let api_routes = Router::new()
        .route("/health", get(health_check))
        .route("/simulate", post(simulate_endpoint))
        .route("/snapshot", post(snapshot_endpoint))
        .route("/validate", post(validate_endpoint))
        .route("/export", post(export_endpoint))
        .route("/compare", post(compare_endpoint))
        .route("/presets", get(get_presets_endpoint))
        .route("/presets/:name", get(get_preset_endpoint))
        .route(
            "/recommendations",
            get(recommendations_endpoint).post(recommendations_endpoint),
        )
        .route(
            "/report/export",
            get(report_export_endpoint).post(report_export_endpoint),
        );

    Router::new()
        .route("/health", get(health_check))
        .nest("/api", api_routes.clone())
        .nest("/api/v1", api_routes)
        .layer(CorsLayer::permissive())
}

#[cfg(not(test))]
#[tokio::main]
async fn main() {
    let app = create_app();

    let addr = SocketAddr::from(([127, 0, 0, 1], 8000));
    println!("Rust Axum server active at http://{}", addr);
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{
        body::Body,
        http::{Request, StatusCode},
    };
    use serde_json::{json, Value};
    use tower::ServiceExt;

    fn valid_scenario_json() -> Value {
        let preset_str = include_str!("../../../../data/01_full_constellation.json");
        serde_json::from_str(preset_str).unwrap()
    }

    fn invalid_scenario_json() -> Value {
        let mut s = valid_scenario_json();
        s["environment"]["altitude_km"] = json!(100.0); // Invalid altitude < 200
        s
    }

    #[tokio::test]
    async fn test_health_routes() {
        let app = create_app();

        let response = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/health")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);

        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let json: Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(json["status"], "ok");
        assert_eq!(json["engine"], "Rust / Axum + cosmo-core");

        let response_v1 = app
            .oneshot(
                Request::builder()
                    .uri("/api/v1/health")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response_v1.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_presets_routes() {
        let app = create_app();

        // 1. Get all presets
        let res_all = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/api/v1/presets")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(res_all.status(), StatusCode::OK);

        // 2. Get valid preset by name
        let res_preset = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/api/v1/presets/01_full_constellation")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(res_preset.status(), StatusCode::OK);

        let res_preset_ext = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/api/v1/presets/01_full_constellation.json")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(res_preset_ext.status(), StatusCode::OK);

        // 3. 404 Missing preset
        let res_missing = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/api/v1/presets/non_existent_preset_999")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(res_missing.status(), StatusCode::NOT_FOUND);

        // 4. Path traversal attempt 1: ../Cargo.toml
        let res_traversal1 = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/api/v1/presets/..%2FCargo.toml")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(res_traversal1.status(), StatusCode::NOT_FOUND);

        // Path traversal attempt 2: ../../README.md
        let res_traversal2 = app
            .oneshot(
                Request::builder()
                    .uri("/api/v1/presets/..%2F..%2FREADME.md")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(res_traversal2.status(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn test_validate_route() {
        let app = create_app();

        // Invalid version
        let payload = json!({
            "schema_version": "invalid_version"
        });

        let response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/validate")
                    .header("content-type", "application/json")
                    .body(Body::from(payload.to_string()))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let json: Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(json["valid"], false);
        assert!(!json["errors"].as_array().unwrap().is_empty());

        // Valid scenario
        let valid_s = valid_scenario_json();
        let res_valid = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/validate")
                    .header("content-type", "application/json")
                    .body(Body::from(valid_s.to_string()))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(res_valid.status(), StatusCode::OK);
        let body_v = axum::body::to_bytes(res_valid.into_body(), usize::MAX)
            .await
            .unwrap();
        let json_v: Value = serde_json::from_slice(&body_v).unwrap();
        assert_eq!(json_v["valid"], true);
        assert!(json_v["errors"].as_array().unwrap().is_empty());
    }

    #[tokio::test]
    async fn test_simulate_endpoint() {
        let app = create_app();

        // 1. Direct body (valid scenario)
        let valid_s = valid_scenario_json();
        let res_direct = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/simulate?metric=distance&include_timeline=true")
                    .header("content-type", "application/json")
                    .body(Body::from(valid_s.to_string()))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(res_direct.status(), StatusCode::OK);

        // 2. Request wrapper body (valid scenario)
        let req_body = json!({
            "scenario": valid_scenario_json(),
            "routing_metric": "hops",
            "include_timeline": false
        });
        let res_req = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/simulate")
                    .header("content-type", "application/json")
                    .body(Body::from(req_body.to_string()))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(res_req.status(), StatusCode::OK);

        // 3. 422 Invalid scenario
        let invalid_s = invalid_scenario_json();
        let res_422 = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/simulate")
                    .header("content-type", "application/json")
                    .body(Body::from(invalid_s.to_string()))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(res_422.status(), StatusCode::UNPROCESSABLE_ENTITY);
        let body = axum::body::to_bytes(res_422.into_body(), usize::MAX)
            .await
            .unwrap();
        let json: Value = serde_json::from_slice(&body).unwrap();
        assert!(!json["errors"].as_array().unwrap().is_empty());
    }

    #[tokio::test]
    async fn test_snapshot_endpoint() {
        let app = create_app();

        // 1. Direct body with full constellation (connected clients)
        let valid_s = valid_scenario_json();
        let res_direct = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/snapshot?t_s=120.0&metric=distance")
                    .header("content-type", "application/json")
                    .body(Body::from(valid_s.to_string()))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(res_direct.status(), StatusCode::OK);

        // 2. Outages scenario (disconnected clients & gateway outage classification)
        let outages_str = include_str!("../../../../data/03_satellite_outages.json");
        let outages_s: Value = serde_json::from_str(outages_str).unwrap();
        let req_body = json!({
            "scenario": outages_s,
            "t_s": 500.0,
            "routing_metric": "hops"
        });
        let res_outage = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/snapshot")
                    .header("content-type", "application/json")
                    .body(Body::from(req_body.to_string()))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(res_outage.status(), StatusCode::OK);

        // 3. 422 Invalid scenario
        let invalid_s = invalid_scenario_json();
        let res_422 = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/snapshot")
                    .header("content-type", "application/json")
                    .body(Body::from(invalid_s.to_string()))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(res_422.status(), StatusCode::UNPROCESSABLE_ENTITY);
    }

    #[tokio::test]
    async fn test_export_endpoint() {
        let app = create_app();

        // 1. Valid export request
        let req_body = json!({
            "scenario": valid_scenario_json(),
            "routing_metric": "distance"
        });
        let res_ok = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/export")
                    .header("content-type", "application/json")
                    .body(Body::from(req_body.to_string()))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(res_ok.status(), StatusCode::OK);

        // 2. Default routing metric export
        let req_default = json!({
            "scenario": valid_scenario_json()
        });
        let res_def = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/export")
                    .header("content-type", "application/json")
                    .body(Body::from(req_default.to_string()))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(res_def.status(), StatusCode::OK);

        // 3. 422 Invalid scenario
        let req_invalid = json!({
            "scenario": invalid_scenario_json()
        });
        let res_422 = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/export")
                    .header("content-type", "application/json")
                    .body(Body::from(req_invalid.to_string()))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(res_422.status(), StatusCode::UNPROCESSABLE_ENTITY);
    }

    #[tokio::test]
    async fn test_compare_endpoint() {
        let app = create_app();

        // 1. Valid compare request
        let s2_str = include_str!("../../../../data/02_first_launch.json");
        let s2_val: Value = serde_json::from_str(s2_str).unwrap();
        let req_body = json!({
            "scenario_a": valid_scenario_json(),
            "scenario_b": s2_val,
            "routing_metric": "distance"
        });
        let res_ok = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/compare")
                    .header("content-type", "application/json")
                    .body(Body::from(req_body.to_string()))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(res_ok.status(), StatusCode::OK);

        // 2. 422 Invalid compare request (scenario_b invalid)
        let req_invalid = json!({
            "scenario_a": valid_scenario_json(),
            "scenario_b": invalid_scenario_json(),
            "routing_metric": "hops"
        });
        let res_422 = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/compare")
                    .header("content-type", "application/json")
                    .body(Body::from(req_invalid.to_string()))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(res_422.status(), StatusCode::UNPROCESSABLE_ENTITY);
    }

    #[tokio::test]
    async fn test_recommendations_endpoint() {
        let app = create_app();

        let res_get = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri("/api/v1/recommendations")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(res_get.status(), StatusCode::OK);

        let res_post = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/recommendations")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(res_post.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_report_export_endpoint() {
        let app = create_app();

        // 1. Default JSON format
        let res_json = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri("/api/v1/report/export")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(res_json.status(), StatusCode::OK);

        // 2. Markdown format query
        let res_md = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri("/api/v1/report/export?format=markdown")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(res_md.status(), StatusCode::OK);
        assert_eq!(
            res_md.headers().get("content-type").unwrap(),
            "text/markdown; charset=utf-8"
        );

        // 3. md format query with POST
        let res_md2 = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/report/export?format=md")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(res_md2.status(), StatusCode::OK);
        assert_eq!(
            res_md2.headers().get("content-type").unwrap(),
            "text/markdown; charset=utf-8"
        );
    }

    #[tokio::test]
    async fn test_api_unversioned_nest_routes() {
        let app = create_app();

        let endpoints = vec![
            "/api/health",
            "/api/presets",
            "/api/recommendations",
            "/api/report/export",
        ];

        for ep in endpoints {
            let res = app
                .clone()
                .oneshot(
                    Request::builder()
                        .uri(ep)
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();
            assert_eq!(res.status(), StatusCode::OK, "Failed for endpoint: {}", ep);
        }
    }

    #[tokio::test]
    async fn test_direct_handler_calls() {
        use axum::{extract::Path, Json};

        // get_preset_endpoint with missing preset
        let res_err = get_preset_endpoint(Path("missing_file_xyz_123".to_string())).await;
        assert!(res_err.is_err());
        let (status, err_json) = res_err.unwrap_err();
        assert_eq!(status, StatusCode::NOT_FOUND);
        assert!(err_json["message"].as_str().unwrap().contains("не найден"));

        // get_preset_endpoint with path traversal
        let res_trav = get_preset_endpoint(Path("../../../Cargo.toml".to_string())).await;
        assert!(res_trav.is_err());
        assert_eq!(res_trav.unwrap_err().0, StatusCode::NOT_FOUND);

        // get_preset_endpoint with .json extension in path
        let res_ext = get_preset_endpoint(Path("01_full_constellation.json".to_string())).await;
        assert!(res_ext.is_ok());

        // export_endpoint fallback metric
        let req_exp = dto::ExportRequest {
            scenario: serde_json::from_value(valid_scenario_json()).unwrap(),
            routing_metric: "hops".to_string(),
        };
        assert!(export_endpoint(Json(req_exp)).await.is_ok());

        // compare_endpoint fallback metric
        let req_comp = dto::CompareRequest {
            scenario_a: serde_json::from_value(valid_scenario_json()).unwrap(),
            scenario_b: serde_json::from_value(valid_scenario_json()).unwrap(),
            routing_metric: "hops".to_string(),
        };
        assert!(compare_endpoint(Json(req_comp)).await.is_ok());
    }

    #[test]
    fn test_dto_helpers_and_config() {
        assert_eq!(dto::default_metric(), "hops");
        assert!(dto::default_true());

        let data_dir = config::find_data_dir();
        assert!(data_dir.exists());

        let docs_dir = config::find_docs_dir();
        assert!(docs_dir.exists());
    }
}




