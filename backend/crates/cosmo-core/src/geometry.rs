use std::collections::{HashMap, HashSet};

use crate::constants::{EARTH_MU, EARTH_OMEGA, EARTH_RADIUS_KM};
use crate::models::{GroundSite, Plane, SatellitePosition, Scenario, SnapshotResult};

pub fn finite(x: f64) -> bool {
    x.is_finite()
}

/// Вычисление координат спутников на момент времени t_s.
/// Возвращает кортеж:
/// - вектор идентификаторов спутников;
/// - вектор координат ECI [км];
/// - вектор координат ECEF [км].
pub fn compute_positions(
    s: &Scenario,
    t_s: f64,
) -> (Vec<String>, Vec<[f64; 3]>, Vec<[f64; 3]>) {
    let e = &s.environment;
    let d = &s.design;

    let pmap: HashMap<&str, &Plane> = d.planes.iter().map(|p| (p.id.as_str(), p)).collect();

    let r = EARTH_RADIUS_KM + e.altitude_km;
    let n = (EARTH_MU / (r * r * r)).sqrt();
    let inc = e.inclination_deg.to_radians();

    let n_sats = d.satellites.len();
    let mut sat_ids = Vec::with_capacity(n_sats);
    let mut eci = Vec::with_capacity(n_sats);

    for sat in &d.satellites {
        sat_ids.push(sat.id.clone());
        let dummy_plane = Plane {
            id: sat.plane_id.clone(),
            raan_deg: 0.0,
            phase_deg: 0.0,
        };
        let plane = pmap.get(sat.plane_id.as_str()).copied().unwrap_or(&dummy_plane);
        let u = (sat.slot_deg + plane.phase_deg).to_radians() + n * t_s;
        let om = plane.raan_deg.to_radians();

        let cu = u.cos();
        let su = u.sin();
        let co = om.cos();
        let so = om.sin();

        let x = r * (co * cu - so * su * inc.cos());
        let y = r * (so * cu + co * su * inc.cos());
        let z = r * (su * inc.sin());

        eci.push([x, y, z]);
    }

    let th = e.earth_angle0_deg.to_radians() + EARTH_OMEGA * t_s;
    let c = th.cos();
    let ss = th.sin();

    let ecef = eci
        .iter()
        .map(|&[x, y, z]| [x * c + y * ss, -x * ss + y * c, z])
        .collect();

    (sat_ids, eci, ecef)
}

/// Вычисление декартовых координат наземного пункта в системе ECEF [км].
pub fn ground_position(g: &GroundSite) -> [f64; 3] {
    let lat = g.lat_deg.to_radians();
    let lon = g.lon_deg.to_radians();
    [
        EARTH_RADIUS_KM * lat.cos() * lon.cos(),
        EARTH_RADIUS_KM * lat.cos() * lon.sin(),
        EARTH_RADIUS_KM * lat.sin(),
    ]
}

/// Преобразование координат ECEF [км] в широту, долготу (град) и высоту (км).
pub fn ecef_to_geodetic(xyz: &[f64; 3]) -> (f64, f64, f64) {
    let x = xyz[0];
    let y = xyz[1];
    let z = xyz[2];
    let hypot_xy = x.hypot(y);
    let lat_deg = z.atan2(hypot_xy).to_degrees();
    let lon_deg = y.atan2(x).to_degrees();
    let alt_km = hypot_xy.hypot(z) - EARTH_RADIUS_KM;
    (lat_deg, lon_deg, alt_km)
}

/// Расчет состояния группировки в момент времени t_s.
pub fn snapshot(s: &Scenario, t_s: f64, fast_edges_only: bool) -> SnapshotResult {
    let (ids, _inertial, ecef) = compute_positions(s, t_s);
    let n_sats = ids.len();

    let failed_set: HashSet<&str> = s
        .failures
        .iter()
        .filter(|f| f.start_s <= t_s && t_s < f.end_s)
        .map(|f| f.satellite_id.as_str())
        .collect();

    let active: Vec<bool> = s
        .design
        .satellites
        .iter()
        .map(|sat| sat.launch_batch <= s.design.launch_stage && !failed_set.contains(sat.id.as_str()))
        .collect();

    let mut edges: Vec<(String, String, f64)> = Vec::new();

    if n_sats > 1 {
        let isl_range = s.environment.isl_range_km;
        let isl_range_sq = isl_range * isl_range;

        for i in 0..n_sats {
            if !active[i] {
                continue;
            }
            for j in (i + 1)..n_sats {
                if !active[j] {
                    continue;
                }

                let dx = ecef[j][0] - ecef[i][0];
                let dy = ecef[j][1] - ecef[i][1];
                let dz = ecef[j][2] - ecef[i][2];
                let denom = dx * dx + dy * dy + dz * dz;

                if denom < isl_range_sq {
                    let dist = denom.sqrt();
                    let dot_i_delta = ecef[i][0] * dx + ecef[i][1] * dy + ecef[i][2] * dz;
                    let lam = (-dot_i_delta / denom.max(1e-12)).clamp(0.0, 1.0);

                    let cx = ecef[i][0] + lam * dx;
                    let cy = ecef[i][1] + lam * dy;
                    let cz = ecef[i][2] + lam * dz;
                    let closest = (cx * cx + cy * cy + cz * cz).sqrt();

                    if dist < isl_range && closest > EARTH_RADIUS_KM {
                        edges.push((ids[i].clone(), ids[j].clone(), dist));
                    }
                }
            }
        }
    }

    let mut elevations: HashMap<String, HashMap<String, f64>> = HashMap::new();
    let min_elev = s.environment.min_elevation_deg;

    for g in &s.ground_sites {
        let gid = &g.id;
        let gp = ground_position(g);

        let is_gw = g.role == "gateway";
        let offline = is_gw
            && s.gateway_outages
                .iter()
                .any(|f| f.gateway_id == *gid && f.start_s <= t_s && t_s < f.end_s);

        let mut site_elevs = HashMap::new();

        for k in 0..n_sats {
            if !active[k] {
                continue;
            }

            let dif = [
                ecef[k][0] - gp[0],
                ecef[k][1] - gp[1],
                ecef[k][2] - gp[2],
            ];
            let dl = (dif[0] * dif[0] + dif[1] * dif[1] + dif[2] * dif[2]).sqrt();
            let dot_val = ((dif[0] * gp[0] + dif[1] * gp[1] + dif[2] * gp[2]) / EARTH_RADIUS_KM) / dl;
            let dot_clamped = dot_val.clamp(-1.0, 1.0);
            let el = dot_clamped.asin().to_degrees();

            site_elevs.insert(ids[k].clone(), el);

            if el >= min_elev && !offline {
                edges.push((gid.clone(), ids[k].clone(), dl));
            }
        }

        elevations.insert(gid.clone(), site_elevs);
    }

    if fast_edges_only {
        return SnapshotResult {
            t_s,
            satellites: vec![],
            edges,
            elevation_deg: elevations,
        };
    }

    let mut satellites_out = Vec::with_capacity(n_sats);
    for k in 0..n_sats {
        let sid = &ids[k];
        let sat_meta = &s.design.satellites[k];
        let (lat, lon, alt) = ecef_to_geodetic(&ecef[k]);

        satellites_out.push(SatellitePosition {
            id: sid.clone(),
            plane_id: Some(sat_meta.plane_id.clone()),
            launch_batch: Some(sat_meta.launch_batch),
            x_km: ecef[k][0],
            y_km: ecef[k][1],
            z_km: ecef[k][2],
            lat_deg: lat,
            lon_deg: lon,
            alt_km: alt,
            active: active[k],
            failed: failed_set.contains(sid.as_str()),
        });
    }

    SnapshotResult {
        t_s,
        satellites: satellites_out,
        edges,
        elevation_deg: elevations,
    }
}
