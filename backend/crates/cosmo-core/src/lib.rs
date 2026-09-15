pub mod compare;
pub mod constants;
pub mod export;
pub mod geometry;
pub mod models;
pub mod routing;
pub mod simulator;
pub mod validator;

pub use compare::{compare_scenarios, diff_scenario_parameters};
pub use constants::*;
pub use export::export_result;
pub use geometry::{compute_positions, ecef_to_geodetic, finite, ground_position, snapshot};
pub use models::*;
pub use routing::{build_adjacency, classify_failure, find_route, RoutingMetric};
pub use simulator::{run_simulation, simulate_scenario};
pub use validator::{validate_scenario, validate_scenario_value};

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    fn load_test_preset(json_str: &str) -> Scenario {
        serde_json::from_str(json_str).expect("Failed to parse test preset JSON")
    }

    #[test]
    fn test_constants_and_helpers() {
        assert_eq!(EARTH_RADIUS_KM, 6371.0);
        assert!((EARTH_MU - 398600.435507).abs() < 1e-6);
        assert_eq!(
            get_failure_description_ru(FAILURE_REASON_NO_CLIENT_SAT),
            "Нет активного спутника над клиентским пунктом (вне зоны видимости)"
        );
        assert_eq!(
            get_failure_description_ru(FAILURE_REASON_GATEWAY_OFFLINE),
            "Все наземные шлюзы на техобслуживании / отключены"
        );
        assert_eq!(
            get_failure_description_ru(FAILURE_REASON_NO_GW_SAT),
            "Нет активного спутника над наземным шлюзом (шлюз вне зоны видимости)"
        );
        assert_eq!(
            get_failure_description_ru(FAILURE_REASON_ISL_DISCONNECTED),
            "Разрыв межспутниковой сети (нет связного пути через ISL)"
        );
    }

    #[test]
    fn test_geometry_helpers() {
        assert!(finite(123.45));
        assert!(!finite(f64::NAN));
        assert!(!finite(f64::INFINITY));

        let g = GroundSite {
            id: "G_TEST".to_string(),
            name: None,
            role: "gateway".to_string(),
            lat_deg: 0.0,
            lon_deg: 0.0,
        };
        let gp = ground_position(&g);
        assert!((gp[0] - EARTH_RADIUS_KM).abs() < 1e-6);
        assert!((gp[1] - 0.0).abs() < 1e-6);
        assert!((gp[2] - 0.0).abs() < 1e-6);

        let (lat, lon, alt) = ecef_to_geodetic(&gp);
        assert!(lat.abs() < 1e-6);
        assert!(lon.abs() < 1e-6);
        assert!(alt.abs() < 1e-6);
    }

    #[test]
    fn test_positions_and_snapshot_preset_01() {
        let preset_str = include_str!("../../../../data/01_full_constellation.json");
        let scenario = load_test_preset(preset_str);

        let (ids, eci, ecef) = compute_positions(&scenario, 0.0);
        assert_eq!(ids.len(), 48);
        assert_eq!(eci.len(), 48);
        assert_eq!(ecef.len(), 48);

        let snap = snapshot(&scenario, 0.0, false);
        assert_eq!(snap.t_s, 0.0);
        assert_eq!(snap.satellites.len(), 48);
        assert!(!snap.edges.is_empty());

        let elev_g_mur = snap.elevation_deg.get("G_MUR").expect("G_MUR present");
        assert!(!elev_g_mur.is_empty());
    }

    #[test]
    fn test_routing_find_route_and_classify_failure() {
        let mut adj = std::collections::HashMap::new();
        // Client C1 connected only to Gateway G1 (direct link prohibited)
        adj.insert("C1".to_string(), vec![("G1".to_string(), 100.0)]);
        adj.insert("G1".to_string(), vec![("C1".to_string(), 100.0)]);

        let mut online_gw = HashSet::new();
        online_gw.insert("G1".to_string());
        let mut all_clients = HashSet::new();
        all_clients.insert("C1".to_string());

        let (path, dist) = find_route(&adj, "C1", &online_gw, &all_clients, RoutingMetric::Hops);
        assert!(path.is_empty());
        assert_eq!(dist, 0.0);

        // Valid path C1 -> SAT1 -> G1
        adj.insert("C1".to_string(), vec![("SAT1".to_string(), 500.0)]);
        adj.insert(
            "SAT1".to_string(),
            vec![("C1".to_string(), 500.0), ("G1".to_string(), 600.0)],
        );
        adj.insert("G1".to_string(), vec![("SAT1".to_string(), 600.0)]);

        let (path_valid, dist_valid) =
            find_route(&adj, "C1", &online_gw, &all_clients, RoutingMetric::Hops);
        assert_eq!(path_valid, vec!["C1", "SAT1", "G1"]);
        assert_eq!(dist_valid, 1100.0);

        let (code1, _) = classify_failure(false, 1, true);
        assert_eq!(code1, FAILURE_REASON_NO_CLIENT_SAT);
        let (code2, _) = classify_failure(true, 0, true);
        assert_eq!(code2, FAILURE_REASON_GATEWAY_OFFLINE);
        let (code3, _) = classify_failure(true, 1, false);
        assert_eq!(code3, FAILURE_REASON_NO_GW_SAT);
        let (code4, _) = classify_failure(true, 1, true);
        assert_eq!(code4, FAILURE_REASON_ISL_DISCONNECTED);
    }

    #[test]
    fn test_simulate_preset_01_full() {
        let preset_str = include_str!("../../../../data/01_full_constellation.json");
        let scenario = load_test_preset(preset_str);

        let res = run_simulation(&scenario, RoutingMetric::Hops, true);
        assert_eq!(res.total_steps, 720);
        assert!(res.summary.all_meet_target);
        assert!(res.summary.average_availability_pct > 95.0);

        for cid in &["C65", "C70", "C72"] {
            let m = res.client_metrics.get(*cid).expect("Client metric found");
            assert!(m.availability_pct >= 90.0);
            assert!(m.meets_target);
            assert!(m.mean_hops.is_some());
            assert!(m.mean_hops.unwrap() >= 2.0);
            assert_eq!(m.timeline.len(), 720);
        }
    }

    #[test]
    fn test_simulate_preset_02_first_launch() {
        let preset_str = include_str!("../../../../data/02_first_launch.json");
        let scenario = load_test_preset(preset_str);

        let res = run_simulation(&scenario, RoutingMetric::Hops, false);
        assert_eq!(res.total_steps, 720);
        assert!(!res.summary.all_meet_target);
        assert!(res.summary.average_availability_pct < 30.0);

        for cid in &["C65", "C70", "C72"] {
            let m = res.client_metrics.get(*cid).expect("Client metric found");
            assert!(m.availability_pct < 50.0);
            assert!(m.max_outage_s > 10000.0);
        }
    }

    #[test]
    fn test_simulate_preset_03_outages() {
        let preset_str = include_str!("../../../../data/03_satellite_outages.json");
        let scenario = load_test_preset(preset_str);

        let res = run_simulation(&scenario, RoutingMetric::Hops, false);
        assert_eq!(res.total_steps, 720);

        for cid in &["C65", "C70", "C72"] {
            let m = res.client_metrics.get(*cid).unwrap();
            let isl_fail = m.failure_breakdown.get("isl_disconnected").copied().unwrap_or(0);
            assert!(isl_fail > 0);
        }
    }

    #[test]
    fn test_simulate_preset_04_link_range() {
        let preset_str = include_str!("../../../../data/04_link_range.json");
        let scenario = load_test_preset(preset_str);

        let res = run_simulation(&scenario, RoutingMetric::Hops, false);
        assert_eq!(res.total_steps, 720);

        for cid in &["C65", "C70", "C72"] {
            let m = res.client_metrics.get(*cid).unwrap();
            let isl_fail = m.failure_breakdown.get("isl_disconnected").copied().unwrap_or(0);
            assert!(isl_fail > 100);
        }
    }

    #[test]
    fn test_validator() {
        let preset_str = include_str!("../../../../data/01_full_constellation.json");
        let scenario = load_test_preset(preset_str);

        let errs = validate_scenario(&scenario);
        assert!(errs.is_empty(), "Expected clean validation, got: {:?}", errs);

        let mut invalid_json: serde_json::Value = serde_json::from_str(preset_str).unwrap();
        invalid_json["environment"]["altitude_km"] = serde_json::Value::from(100.0);
        let errs_inv = validator::validate_scenario_value(&invalid_json);
        assert!(!errs_inv.is_empty());
        assert!(errs_inv.iter().any(|e| e.contains("altitude_km")));
    }

    #[test]
    fn test_compare_and_export() {
        let s1 = load_test_preset(include_str!("../../../../data/01_full_constellation.json"));
        let s2 = load_test_preset(include_str!("../../../../data/02_first_launch.json"));

        let comp = compare_scenarios(&s1, &s2, RoutingMetric::Hops);
        assert!(comp.summary.delta_average_availability_pct < -50.0);
        assert!(comp.parameter_differences.iter().any(|d| d.field == "design.launch_stage"));

        // Test identical comparison
        let comp_same = compare_scenarios(&s1, &s1, RoutingMetric::Distance);
        assert_eq!(comp_same.summary.delta_average_availability_pct, 0.0);
        assert!(comp_same.summary.recommendation.contains("идентична"));

        // Test s2 vs s1 (b > a)
        let comp_improved = compare_scenarios(&s2, &s1, RoutingMetric::Hops);
        assert!(comp_improved.summary.delta_average_availability_pct > 50.0);
        assert!(comp_improved.summary.recommendation.contains("превосходит"));
        assert!(comp_improved.summary.recommendation.contains("все пункты вышли"));

        let exported = export_result(&s1, RoutingMetric::Hops);
        assert_eq!(exported.schema_version, SCHEMA_VERSION_RESULT);
        assert_eq!(exported.routes.len(), 720 * 3);
        assert_eq!(exported.metrics.len(), 3);
        assert!(!exported.metrics.get("C65").unwrap().as_object().unwrap().contains_key("timeline"));
    }

    #[test]
    fn test_routing_metric_from_str_and_diff_branches() {
        assert_eq!(RoutingMetric::from_str("hops"), RoutingMetric::Hops);
        assert_eq!(RoutingMetric::from_str("HOPS"), RoutingMetric::Hops);
        assert_eq!(RoutingMetric::from_str("distance"), RoutingMetric::Distance);
        assert_eq!(RoutingMetric::from_str("other"), RoutingMetric::Distance);

        let s1 = load_test_preset(include_str!("../../../../data/01_full_constellation.json"));
        let mut s2 = s1.clone();

        // Mutate s2 to trigger diff_scenario_parameters branches
        s2.environment.altitude_km = 700.0;
        s2.design.launch_stage = 2;
        s2.design.planes[0].raan_deg = 45.0;
        s2.design.satellites.pop(); // different satellites_count
        s2.ground_sites[0].lat_deg = 70.0;
        s2.failures.push(models::SatelliteFailure {
            satellite_id: "SAT_101".to_string(),
            start_s: 0.0,
            end_s: 100.0,
        });
        s2.gateway_outages.push(models::GatewayOutage {
            gateway_id: "G_MUR".to_string(),
            start_s: 0.0,
            end_s: 100.0,
        });

        let diffs = diff_scenario_parameters(&s1, &s2);
        assert!(diffs.iter().any(|d| d.field.starts_with("environment.")));
        assert!(diffs.iter().any(|d| d.field == "design.launch_stage"));
        assert!(diffs.iter().any(|d| d.field.starts_with("design.planes")));
        assert!(diffs.iter().any(|d| d.field == "design.satellites_count"));
        assert!(diffs.iter().any(|d| d.field.starts_with("ground_sites")));
        assert!(diffs.iter().any(|d| d.field == "failures_count"));
        assert!(diffs.iter().any(|d| d.field == "gateway_outages_count"));

        // Same length satellites, failures & gateway_outages but modified content
        let mut s3 = s1.clone();
        s3.design.satellites[0].slot_deg = 99.0;
        s3.failures.push(models::SatelliteFailure {
            satellite_id: "SAT_101".to_string(),
            start_s: 0.0,
            end_s: 100.0,
        });
        s3.gateway_outages.push(models::GatewayOutage {
            gateway_id: "G_MUR".to_string(),
            start_s: 0.0,
            end_s: 100.0,
        });

        let diffs_sat = diff_scenario_parameters(&s1, &s3);
        assert!(diffs_sat.iter().any(|d| d.field == "design.satellites"));

        let mut s4 = s3.clone();
        s4.failures[0].end_s = 200.0;
        s4.gateway_outages[0].end_s = 200.0;

        let diffs2 = diff_scenario_parameters(&s3, &s4);
        assert!(diffs2.iter().any(|d| d.field == "failures"));
        assert!(diffs2.iter().any(|d| d.field == "gateway_outages"));
    }
}

