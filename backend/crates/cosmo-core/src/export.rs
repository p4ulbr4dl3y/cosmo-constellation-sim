use std::collections::HashMap;

use crate::constants::SCHEMA_VERSION_RESULT;
use crate::models::{ExportResult, Scenario};
use crate::routing::RoutingMetric;
use crate::simulator::run_simulation;

pub fn export_result(scenario: &Scenario, metric: RoutingMetric) -> ExportResult {
    let sim = run_simulation(scenario, metric, false);

    let scenario_json = serde_json::to_value(scenario).unwrap_or(serde_json::Value::Null);

    let mut clean_metrics = HashMap::new();
    for (cid, m) in sim.client_metrics {
        let mut m_val = serde_json::to_value(&m).unwrap_or(serde_json::Value::Null);
        if let Some(obj) = m_val.as_object_mut() {
            obj.remove("timeline");
            obj.remove("outage_intervals");
        }
        clean_metrics.insert(cid, m_val);
    }

    ExportResult {
        schema_version: SCHEMA_VERSION_RESULT.to_string(),
        effective_scenario: scenario_json,
        routes: sim.routes,
        metrics: clean_metrics,
        summary: sim.summary,
    }
}
