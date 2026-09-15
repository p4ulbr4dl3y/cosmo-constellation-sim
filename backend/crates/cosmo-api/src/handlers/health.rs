use axum::Json;
use cosmo_core::EARTH_RADIUS_KM;

use crate::dto::HealthResponse;

/// Проверка работоспособности сервиса моделирования.
pub async fn health_check() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok",
        earth_radius_km: EARTH_RADIUS_KM,
        engine: "Rust / Axum + cosmo-core",
    })
}
