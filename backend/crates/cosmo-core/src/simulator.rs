use std::collections::{HashMap, HashSet};

use crate::geometry::snapshot;
use crate::models::{
    ClientMetrics, OutageInterval, RouteRecord, Scenario, SimulationResult, SimulationSummary,
    TimelineEntry,
};
use crate::routing::{build_adjacency, classify_failure, find_route, RoutingMetric};

fn round2(val: f64) -> f64 {
    (val * 100.0).round() / 100.0
}

fn round4(val: f64) -> f64 {
    (val * 10000.0).round() / 10000.0
}

struct InternalClientData {
    steps_with_path: usize,
    steps_with_vis: usize,
    current_outage_steps: usize,
    max_outage_steps: usize,
    hops_list: Vec<usize>,
    distance_list: Vec<f64>,
    failure_counts: HashMap<String, usize>,
    timeline: Vec<TimelineEntry>,
    current_outage_start: Option<f64>,
    current_outage_reason: Option<String>,
    outage_intervals: Vec<OutageInterval>,
}

pub fn run_simulation(
    scenario: &Scenario,
    metric: RoutingMetric,
    include_timeline: bool,
) -> SimulationResult {
    let env = &scenario.environment;
    let step_s = env.step_s;
    let horizon_s = env.horizon_s;
    let target_avail = env.target_availability;

    let clients: Vec<String> = scenario
        .ground_sites
        .iter()
        .filter(|g| g.role == "client")
        .map(|g| g.id.clone())
        .collect();
    let all_clients_set: HashSet<String> = clients.iter().cloned().collect();

    let gateways: Vec<String> = scenario
        .ground_sites
        .iter()
        .filter(|g| g.role == "gateway")
        .map(|g| g.id.clone())
        .collect();
    let all_gw_set: HashSet<String> = gateways.iter().cloned().collect();

    let time_steps: Vec<i64> = (0..horizon_s).step_by(step_s as usize).collect();
    let total_steps = time_steps.len();

    let mut client_data: HashMap<String, InternalClientData> = clients
        .iter()
        .map(|cid| {
            let mut fc = HashMap::new();
            fc.insert("no_client_satellite".to_string(), 0);
            fc.insert("gateway_offline".to_string(), 0);
            fc.insert("no_gateway_satellite".to_string(), 0);
            fc.insert("isl_disconnected".to_string(), 0);

            (
                cid.clone(),
                InternalClientData {
                    steps_with_path: 0,
                    steps_with_vis: 0,
                    current_outage_steps: 0,
                    max_outage_steps: 0,
                    hops_list: vec![],
                    distance_list: vec![],
                    failure_counts: fc,
                    timeline: vec![],
                    current_outage_start: None,
                    current_outage_reason: None,
                    outage_intervals: vec![],
                },
            )
        })
        .collect();

    let mut all_routes: Vec<RouteRecord> = Vec::new();

    for &t_step in &time_steps {
        let t_s = t_step as f64;
        let snap = snapshot(scenario, t_s, true);
        let adj = build_adjacency(&snap.edges);

        let cur_gw_outages: HashSet<&str> = scenario
            .gateway_outages
            .iter()
            .filter(|f| f.start_s <= t_s && t_s < f.end_s)
            .map(|f| f.gateway_id.as_str())
            .collect();

        let online_gateways: HashSet<String> = all_gw_set
            .iter()
            .filter(|gid| !cur_gw_outages.contains(gid.as_str()))
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

        for cid in &clients {
            let cdata = client_data.get_mut(cid).unwrap();

            let has_client_sat = adj.get(cid).map_or(false, |neighbors| {
                neighbors
                    .iter()
                    .any(|(nxt, _)| !all_clients_set.contains(nxt) && !all_gw_set.contains(nxt))
            });

            if has_client_sat {
                cdata.steps_with_vis += 1;
            }

            let (path, total_dist) = find_route(&adj, cid, &online_gateways, &all_clients_set, metric);

            all_routes.push(RouteRecord {
                t_s,
                client_id: cid.clone(),
                path: path.clone(),
            });

            let has_path = !path.is_empty();

            if has_path {
                cdata.steps_with_path += 1;
                let hops = path.len() - 1;
                cdata.hops_list.push(hops);
                cdata.distance_list.push(total_dist);

                if cdata.current_outage_steps > 0 {
                    let outage_dur = (cdata.current_outage_steps * step_s as usize) as f64;
                    cdata.outage_intervals.push(OutageInterval {
                        start_s: cdata.current_outage_start.unwrap(),
                        end_s: t_s,
                        duration_s: outage_dur,
                        reason: cdata.current_outage_reason.take().unwrap(),
                    });
                    cdata.current_outage_steps = 0;
                    cdata.current_outage_start = None;
                }

                if include_timeline {
                    cdata.timeline.push(TimelineEntry {
                        t_s,
                        status: "ok".to_string(),
                        has_route: true,
                        has_visibility: has_client_sat,
                        hops,
                        path,
                        distance_km: round2(total_dist),
                        failure_code: None,
                        failure_reason: None,
                    });
                }
            } else {
                let (fail_code, fail_desc) =
                    classify_failure(has_client_sat, online_gateways.len(), gw_has_sat);
                *cdata.failure_counts.get_mut(fail_code).unwrap() += 1;

                if cdata.current_outage_steps == 0 {
                    cdata.current_outage_start = Some(t_s);
                    cdata.current_outage_reason = Some(fail_code.to_string());
                }

                cdata.current_outage_steps += 1;
                if cdata.current_outage_steps > cdata.max_outage_steps {
                    cdata.max_outage_steps = cdata.current_outage_steps;
                }

                if include_timeline {
                    cdata.timeline.push(TimelineEntry {
                        t_s,
                        status: "outage".to_string(),
                        has_route: false,
                        has_visibility: has_client_sat,
                        hops: 0,
                        path: vec![],
                        distance_km: 0.0,
                        failure_code: Some(fail_code.to_string()),
                        failure_reason: Some(fail_desc.to_string()),
                    });
                }
            }
        }
    }

    for cid in &clients {
        let cdata = client_data.get_mut(cid).unwrap();
        if cdata.current_outage_steps > 0 {
            let outage_dur = (cdata.current_outage_steps * step_s as usize) as f64;
            cdata.outage_intervals.push(OutageInterval {
                start_s: cdata.current_outage_start.unwrap(),
                end_s: horizon_s as f64,
                duration_s: outage_dur,
                reason: cdata.current_outage_reason.take().unwrap(),
            });
        }
    }

    let mut client_metrics = HashMap::new();
    let mut total_avail_pct = 0.0;
    let mut min_avail_pct = 100.0;

    for cid in &clients {
        let cdata = client_data.get_mut(cid).unwrap();
        let avail_ratio = if total_steps > 0 {
            cdata.steps_with_path as f64 / total_steps as f64
        } else {
            0.0
        };
        let vis_ratio = if total_steps > 0 {
            cdata.steps_with_vis as f64 / total_steps as f64
        } else {
            0.0
        };
        let avail_pct = avail_ratio * 100.0;
        let vis_pct = vis_ratio * 100.0;

        total_avail_pct += avail_pct;
        if avail_pct < min_avail_pct {
            min_avail_pct = avail_pct;
        }

        let max_outage_s = (cdata.max_outage_steps * step_s as usize) as f64;
        let total_outage_s = ((total_steps - cdata.steps_with_path) * step_s as usize) as f64;

        let mean_hops = if !cdata.hops_list.is_empty() {
            let sum: usize = cdata.hops_list.iter().sum();
            Some(round2(sum as f64 / cdata.hops_list.len() as f64))
        } else {
            None
        };
        let max_hops = cdata.hops_list.iter().copied().max();
        let min_hops = cdata.hops_list.iter().copied().min();

        let mean_dist = if !cdata.distance_list.is_empty() {
            let sum: f64 = cdata.distance_list.iter().sum();
            Some(round2(sum / cdata.distance_list.len() as f64))
        } else {
            None
        };

        client_metrics.insert(
            cid.clone(),
            ClientMetrics {
                client_id: cid.clone(),
                availability_pct: round2(avail_pct),
                availability_ratio: round4(avail_ratio),
                visibility_pct: round2(vis_pct),
                visibility_ratio: round4(vis_ratio),
                max_outage_s,
                total_outage_s,
                mean_hops,
                max_hops,
                min_hops,
                mean_distance_km: mean_dist,
                meets_target: avail_ratio >= target_avail,
                target_availability: target_avail,
                failure_breakdown: cdata.failure_counts.clone(),
                outage_intervals: cdata.outage_intervals.clone(),
                timeline: if include_timeline {
                    cdata.timeline.clone()
                } else {
                    vec![]
                },
            },
        );
    }

    let avg_avail = if !clients.is_empty() {
        round2(total_avail_pct / clients.len() as f64)
    } else {
        0.0
    };

    let summary = SimulationSummary {
        average_availability_pct: avg_avail,
        min_availability_pct: if !clients.is_empty() {
            round2(min_avail_pct)
        } else {
            0.0
        },
        all_meet_target: client_metrics.values().all(|m| m.meets_target),
    };

    SimulationResult {
        scenario_meta: scenario.meta.clone().unwrap_or(serde_json::Value::Null),
        total_steps,
        step_s,
        horizon_s,
        target_availability: target_avail,
        summary,
        client_metrics,
        routes: all_routes,
    }
}

pub fn simulate_scenario(
    scenario: &Scenario,
    metric: RoutingMetric,
    include_timeline: bool,
) -> SimulationResult {
    run_simulation(scenario, metric, include_timeline)
}
