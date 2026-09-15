use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Environment {
    pub altitude_km: f64,
    pub inclination_deg: f64,
    pub earth_angle0_deg: f64,
    pub horizon_s: i64,
    pub step_s: i64,
    pub min_elevation_deg: f64,
    pub isl_range_km: f64,
    #[serde(default = "default_target_availability")]
    pub target_availability: f64,
}

fn default_target_availability() -> f64 {
    0.9
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Plane {
    pub id: String,
    pub raan_deg: f64,
    pub phase_deg: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Satellite {
    pub id: String,
    pub plane_id: String,
    pub slot_deg: f64,
    pub launch_batch: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Design {
    pub launch_stage: i32,
    pub planes: Vec<Plane>,
    pub satellites: Vec<Satellite>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct GroundSite {
    pub id: String,
    #[serde(default)]
    pub name: Option<String>,
    pub role: String,
    pub lat_deg: f64,
    pub lon_deg: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SatelliteFailure {
    pub satellite_id: String,
    pub start_s: f64,
    pub end_s: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct GatewayOutage {
    pub gateway_id: String,
    pub start_s: f64,
    pub end_s: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Scenario {
    #[serde(default)]
    pub schema_version: Option<String>,
    #[serde(default)]
    pub meta: Option<serde_json::Value>,
    pub environment: Environment,
    pub design: Design,
    pub ground_sites: Vec<GroundSite>,
    #[serde(default)]
    pub failures: Vec<SatelliteFailure>,
    #[serde(default)]
    pub gateway_outages: Vec<GatewayOutage>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SatellitePosition {
    pub id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub plane_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub launch_batch: Option<i32>,
    pub x_km: f64,
    pub y_km: f64,
    pub z_km: f64,
    pub lat_deg: f64,
    pub lon_deg: f64,
    pub alt_km: f64,
    pub active: bool,
    pub failed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SnapshotResult {
    pub t_s: f64,
    pub satellites: Vec<SatellitePosition>,
    pub edges: Vec<(String, String, f64)>,
    pub elevation_deg: HashMap<String, HashMap<String, f64>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RouteRecord {
    pub t_s: f64,
    pub client_id: String,
    pub path: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct OutageInterval {
    pub start_s: f64,
    pub end_s: f64,
    pub duration_s: f64,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TimelineEntry {
    pub t_s: f64,
    pub status: String,
    pub has_route: bool,
    pub has_visibility: bool,
    pub hops: usize,
    pub path: Vec<String>,
    pub distance_km: f64,
    pub failure_code: Option<String>,
    pub failure_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ClientMetrics {
    pub client_id: String,
    pub availability_pct: f64,
    pub availability_ratio: f64,
    pub visibility_pct: f64,
    pub visibility_ratio: f64,
    pub max_outage_s: f64,
    pub total_outage_s: f64,
    pub mean_hops: Option<f64>,
    pub max_hops: Option<usize>,
    pub min_hops: Option<usize>,
    pub mean_distance_km: Option<f64>,
    pub meets_target: bool,
    pub target_availability: f64,
    pub failure_breakdown: HashMap<String, usize>,
    pub outage_intervals: Vec<OutageInterval>,
    #[serde(default)]
    pub timeline: Vec<TimelineEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SimulationSummary {
    pub average_availability_pct: f64,
    pub min_availability_pct: f64,
    pub all_meet_target: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SimulationResult {
    #[serde(default)]
    pub scenario_meta: serde_json::Value,
    pub total_steps: usize,
    pub step_s: i64,
    pub horizon_s: i64,
    pub target_availability: f64,
    pub summary: SimulationSummary,
    pub client_metrics: HashMap<String, ClientMetrics>,
    pub routes: Vec<RouteRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ParameterDiff {
    pub field: String,
    pub value_a: serde_json::Value,
    pub value_b: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ClientComparison {
    pub client_id: String,
    pub metrics_a: ClientMetrics,
    pub metrics_b: ClientMetrics,
    pub delta_availability_pct: f64,
    pub delta_visibility_pct: f64,
    pub delta_max_outage_s: f64,
    pub delta_mean_hops: Option<f64>,
    pub status_change: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ComparisonSummary {
    pub scenario_a: SimulationSummary,
    pub scenario_b: SimulationSummary,
    pub delta_average_availability_pct: f64,
    pub delta_min_availability_pct: f64,
    pub recommendation: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ComparisonResult {
    pub parameter_differences: Vec<ParameterDiff>,
    pub summary: ComparisonSummary,
    pub client_comparison: HashMap<String, ClientComparison>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ExportResult {
    pub schema_version: String,
    pub effective_scenario: serde_json::Value,
    pub routes: Vec<RouteRecord>,
    pub metrics: HashMap<String, serde_json::Value>,
    pub summary: SimulationSummary,
}
