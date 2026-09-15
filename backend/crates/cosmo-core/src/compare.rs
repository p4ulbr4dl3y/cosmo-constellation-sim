use std::collections::{HashMap, HashSet};

use crate::models::{
    ClientComparison, ComparisonResult, ComparisonSummary, ParameterDiff, Scenario,
};
use crate::routing::RoutingMetric;
use crate::simulator::run_simulation;

fn round2(val: f64) -> f64 {
    (val * 100.0).round() / 100.0
}

pub fn diff_scenario_parameters(a: &Scenario, b: &Scenario) -> Vec<ParameterDiff> {
    let mut diffs = Vec::new();

    let val_a = serde_json::to_value(a).unwrap_or(serde_json::Value::Null);
    let val_b = serde_json::to_value(b).unwrap_or(serde_json::Value::Null);

    let env_a = val_a.get("environment").and_then(|v| v.as_object());
    let env_b = val_b.get("environment").and_then(|v| v.as_object());

    let mut env_keys = HashSet::new();
    if let Some(ea) = env_a {
        for k in ea.keys() {
            env_keys.insert(k.clone());
        }
    }
    if let Some(eb) = env_b {
        for k in eb.keys() {
            env_keys.insert(k.clone());
        }
    }
    let mut sorted_env_keys: Vec<_> = env_keys.into_iter().collect();
    sorted_env_keys.sort();

    for k in sorted_env_keys {
        let va = env_a.and_then(|m| m.get(&k)).unwrap_or(&serde_json::Value::Null);
        let vb = env_b.and_then(|m| m.get(&k)).unwrap_or(&serde_json::Value::Null);
        if va != vb {
            diffs.push(ParameterDiff {
                field: format!("environment.{k}"),
                value_a: va.clone(),
                value_b: vb.clone(),
            });
        }
    }

    if a.design.launch_stage != b.design.launch_stage {
        diffs.push(ParameterDiff {
            field: "design.launch_stage".to_string(),
            value_a: serde_json::Value::from(a.design.launch_stage),
            value_b: serde_json::Value::from(b.design.launch_stage),
        });
    }

    let planes_a: HashMap<String, serde_json::Value> = a
        .design
        .planes
        .iter()
        .map(|p| (p.id.clone(), serde_json::to_value(p).unwrap()))
        .collect();
    let planes_b: HashMap<String, serde_json::Value> = b
        .design
        .planes
        .iter()
        .map(|p| (p.id.clone(), serde_json::to_value(p).unwrap()))
        .collect();

    let mut plane_ids = HashSet::new();
    for pid in planes_a.keys().chain(planes_b.keys()) {
        plane_ids.insert(pid.clone());
    }
    let mut sorted_plane_ids: Vec<_> = plane_ids.into_iter().collect();
    sorted_plane_ids.sort();

    for pid in sorted_plane_ids {
        let pa = planes_a.get(&pid).unwrap_or(&serde_json::Value::Null);
        let pb = planes_b.get(&pid).unwrap_or(&serde_json::Value::Null);
        if pa != pb {
            diffs.push(ParameterDiff {
                field: format!("design.planes[{pid}]"),
                value_a: pa.clone(),
                value_b: pb.clone(),
            });
        }
    }

    let sats_a = &a.design.satellites;
    let sats_b = &b.design.satellites;
    if sats_a.len() != sats_b.len() {
        diffs.push(ParameterDiff {
            field: "design.satellites_count".to_string(),
            value_a: serde_json::Value::from(sats_a.len()),
            value_b: serde_json::Value::from(sats_b.len()),
        });
    } else if sats_a != sats_b {
        diffs.push(ParameterDiff {
            field: "design.satellites".to_string(),
            value_a: serde_json::Value::String("modified".to_string()),
            value_b: serde_json::Value::String("modified".to_string()),
        });
    }

    let gs_a: HashMap<String, serde_json::Value> = a
        .ground_sites
        .iter()
        .map(|g| (g.id.clone(), serde_json::to_value(g).unwrap()))
        .collect();
    let gs_b: HashMap<String, serde_json::Value> = b
        .ground_sites
        .iter()
        .map(|g| (g.id.clone(), serde_json::to_value(g).unwrap()))
        .collect();

    let mut gs_ids = HashSet::new();
    for gid in gs_a.keys().chain(gs_b.keys()) {
        gs_ids.insert(gid.clone());
    }
    let mut sorted_gs_ids: Vec<_> = gs_ids.into_iter().collect();
    sorted_gs_ids.sort();

    for gid in sorted_gs_ids {
        let ga = gs_a.get(&gid).unwrap_or(&serde_json::Value::Null);
        let gb = gs_b.get(&gid).unwrap_or(&serde_json::Value::Null);
        if ga != gb {
            diffs.push(ParameterDiff {
                field: format!("ground_sites[{gid}]"),
                value_a: ga.clone(),
                value_b: gb.clone(),
            });
        }
    }

    let fails_a = &a.failures;
    let fails_b = &b.failures;
    if fails_a.len() != fails_b.len() {
        diffs.push(ParameterDiff {
            field: "failures_count".to_string(),
            value_a: serde_json::Value::from(fails_a.len()),
            value_b: serde_json::Value::from(fails_b.len()),
        });
    } else if fails_a != fails_b {
        diffs.push(ParameterDiff {
            field: "failures".to_string(),
            value_a: serde_json::to_value(fails_a).unwrap(),
            value_b: serde_json::to_value(fails_b).unwrap(),
        });
    }

    let gw_a = &a.gateway_outages;
    let gw_b = &b.gateway_outages;
    if gw_a.len() != gw_b.len() {
        diffs.push(ParameterDiff {
            field: "gateway_outages_count".to_string(),
            value_a: serde_json::Value::from(gw_a.len()),
            value_b: serde_json::Value::from(gw_b.len()),
        });
    } else if gw_a != gw_b {
        diffs.push(ParameterDiff {
            field: "gateway_outages".to_string(),
            value_a: serde_json::to_value(gw_a).unwrap(),
            value_b: serde_json::to_value(gw_b).unwrap(),
        });
    }

    diffs
}

pub fn compare_scenarios(
    scenario_a: &Scenario,
    scenario_b: &Scenario,
    metric: RoutingMetric,
) -> ComparisonResult {
    let sim_a = run_simulation(scenario_a, metric, false);
    let sim_b = run_simulation(scenario_b, metric, false);

    let param_diff = diff_scenario_parameters(scenario_a, scenario_b);

    let clients_a = &sim_a.client_metrics;
    let clients_b = &sim_b.client_metrics;

    let mut common_clients: Vec<String> = clients_a
        .keys()
        .filter(|k| clients_b.contains_key(*k))
        .cloned()
        .collect();
    common_clients.sort();

    let mut client_deltas = HashMap::new();
    for cid in &common_clients {
        let ma = &clients_a[cid];
        let mb = &clients_b[cid];

        let delta_avail = round2(mb.availability_pct - ma.availability_pct);
        let delta_vis = round2(mb.visibility_pct - ma.visibility_pct);
        let delta_outage = mb.max_outage_s - ma.max_outage_s;

        let delta_hops = match (ma.mean_hops, mb.mean_hops) {
            (Some(ha), Some(hb)) => Some(round2(hb - ha)),
            _ => None,
        };

        let status_change = if delta_avail > 0.5 {
            "improved".to_string()
        } else if delta_avail < -0.5 {
            "degraded".to_string()
        } else {
            "unchanged".to_string()
        };

        client_deltas.insert(
            cid.clone(),
            ClientComparison {
                client_id: cid.clone(),
                metrics_a: ma.clone(),
                metrics_b: mb.clone(),
                delta_availability_pct: delta_avail,
                delta_visibility_pct: delta_vis,
                delta_max_outage_s: delta_outage,
                delta_mean_hops: delta_hops,
                status_change,
            },
        );
    }

    let sum_a = &sim_a.summary;
    let sum_b = &sim_b.summary;
    let avg_delta = round2(sum_b.average_availability_pct - sum_a.average_availability_pct);
    let min_delta = round2(sum_b.min_availability_pct - sum_a.min_availability_pct);

    let mut notes = Vec::new();
    if avg_delta > 0.0 {
        notes.push(format!(
            "Вариант B превосходит вариант A по средней доступности на +{avg_delta}%."
        ));
    } else if avg_delta < 0.0 {
        notes.push(format!(
            "Вариант B уступает варианту A по средней доступности на {avg_delta}%."
        ));
    } else {
        notes.push("Средняя доступность вариантов идентична.".to_string());
    }

    if sum_b.all_meet_target && !sum_a.all_meet_target {
        notes.push("В варианте B все пункты вышли на целевой уровень доступности (>= 90%).".to_string());
    } else if !sum_b.all_meet_target && sum_a.all_meet_target {
        notes.push("В варианте B утрачено соответствие целевому уровню доступности (>= 90%).".to_string());
    }

    let recommendation = notes.join(" ");

    ComparisonResult {
        parameter_differences: param_diff,
        summary: ComparisonSummary {
            scenario_a: sum_a.clone(),
            scenario_b: sum_b.clone(),
            delta_average_availability_pct: avg_delta,
            delta_min_availability_pct: min_delta,
            recommendation,
        },
        client_comparison: client_deltas,
    }
}
