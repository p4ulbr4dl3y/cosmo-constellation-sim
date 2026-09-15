use wasm_bindgen::prelude::*;
use cosmo_core::{
    build_adjacency, find_route, run_simulation, snapshot, validate_scenario,
    RoutingMetric, Scenario,
};
use std::collections::HashSet;

#[wasm_bindgen]
pub fn simulate_scenario_wasm(scenario_json: &str, metric: &str, include_timeline: bool) -> Result<String, JsValue> {
    let scenario: Scenario = serde_json::from_str(scenario_json)
        .map_err(|e| JsValue::from_str(&format!("Invalid scenario JSON: {}", e)))?;
    
    let m = match metric {
        "distance" => RoutingMetric::Distance,
        _ => RoutingMetric::Hops,
    };

    let result = run_simulation(&scenario, m, include_timeline);
    serde_json::to_string(&result)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

#[wasm_bindgen]
pub fn snapshot_wasm(scenario_json: &str, t_s: f64) -> Result<String, JsValue> {
    let scenario: Scenario = serde_json::from_str(scenario_json)
        .map_err(|e| JsValue::from_str(&format!("Invalid scenario JSON: {}", e)))?;
    
    let result = snapshot(&scenario, t_s, false);
    serde_json::to_string(&result)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

#[wasm_bindgen]
pub fn validate_scenario_wasm(scenario_json: &str) -> Result<String, JsValue> {
    let scenario: Scenario = serde_json::from_str(scenario_json)
        .map_err(|e| JsValue::from_str(&format!("Invalid scenario JSON: {}", e)))?;
    
    let errors = validate_scenario(&scenario);
    serde_json::to_string(&errors)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}
