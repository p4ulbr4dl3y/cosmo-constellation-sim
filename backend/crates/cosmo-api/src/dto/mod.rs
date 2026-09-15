use cosmo_core::Scenario;
use serde::{Deserialize, Serialize};

/// Возвращает метрику маршрутизации по умолчанию ("hops").
pub fn default_metric() -> String {
    "hops".to_string()
}

/// Возвращает логическое значение по умолчанию (true).
pub fn default_true() -> bool {
    true
}

/// Ответ для проверки работоспособности сервиса.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct HealthResponse {
    pub status: &'static str,
    pub earth_radius_km: f64,
    pub engine: &'static str,
}

/// Структура запроса на моделирование.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimulateRequest {
    pub scenario: Scenario,
    #[serde(default = "default_metric")]
    pub routing_metric: String,
    #[serde(default = "default_true")]
    pub include_timeline: bool,
}

/// Полезная нагрузка моделирования (обертка запроса или прямой сценарий).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum SimulateBody {
    Request(SimulateRequest),
    Direct(Scenario),
}

/// Параметры URL-запроса для моделирования.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimulateQuery {
    pub metric: Option<String>,
    pub include_timeline: Option<bool>,
}

/// Структура запроса мгновенного снимка.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SnapshotRequest {
    pub scenario: Scenario,
    #[serde(default)]
    pub t_s: f64,
    #[serde(default = "default_metric")]
    pub routing_metric: String,
}

/// Полезная нагрузка мгновенного снимка (обертка запроса или прямой сценарий).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum SnapshotBody {
    Request(SnapshotRequest),
    Direct(Scenario),
}

/// Параметры URL-запроса мгновенного снимка.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SnapshotQuery {
    pub t_s: Option<f64>,
    pub metric: Option<String>,
}

/// Структура запроса на экспорт результатов.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportRequest {
    pub scenario: Scenario,
    #[serde(default = "default_metric")]
    pub routing_metric: String,
}

/// Структура запроса на сравнение двух сценариев.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompareRequest {
    pub scenario_a: Scenario,
    pub scenario_b: Scenario,
    #[serde(default = "default_metric")]
    pub routing_metric: String,
}

/// Параметры URL-запроса экспорта отчета.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReportQuery {
    pub format: Option<String>,
}
