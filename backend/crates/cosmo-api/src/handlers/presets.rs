use axum::{extract::Path, http::StatusCode, Json};
use cosmo_core::Scenario;
use serde_json::{json, Value};
use std::{fs, path::Path as StdPath};

use crate::config::find_data_dir;

/// Получение списка всех доступных конфигураций пресетов.
pub async fn get_presets_endpoint() -> Json<Value> {
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

/// Получение содержимого сценария пресета по имени.
pub async fn get_preset_endpoint(
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

    let canonical_data = data_dir.canonicalize().unwrap_or_else(|_| data_dir.clone());
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
