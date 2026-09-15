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
    use serde_json::Value;
    use tower::ServiceExt;

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
    async fn test_presets_route() {
        let app = create_app();

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/api/v1/presets")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_validate_route() {
        let app = create_app();

        let payload = serde_json::json!({
            "schema_version": "invalid_version"
        });

        let response = app
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
    }
}
