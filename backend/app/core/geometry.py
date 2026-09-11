from __future__ import annotations

import math
import numpy as np

from app.core.constants import EARTH_OMEGA, EARTH_RADIUS_KM, EARTH_MU


def finite(x: object) -> bool:
    return isinstance(x, (int, float)) and (not isinstance(x, bool)) and math.isfinite(x)


def compute_positions(s: dict, t_s: float) -> tuple[list[str], np.ndarray, np.ndarray]:
    """
    Return satellite IDs, model inertial positions [km], Earth-fixed positions [km].
    Faithful to reference geometry.py.
    """
    e, d = (s["environment"], s["design"])
    pmap = {p["id"]: p for p in d["planes"]}
    r = EARTH_RADIUS_KM + float(e["altitude_km"])
    n = math.sqrt(EARTH_MU / r**3)
    inc = math.radians(float(e["inclination_deg"]))
    
    u = np.array([
        math.radians(float(x["slot_deg"]) + float(pmap[x["plane_id"]]["phase_deg"])) + n * t_s
        for x in d["satellites"]
    ], dtype=np.float64)
    om = np.array([
        math.radians(float(pmap[x["plane_id"]]["raan_deg"]))
        for x in d["satellites"]
    ], dtype=np.float64)

    cu, su, co, so = np.cos(u), np.sin(u), np.cos(om), np.sin(om)
    xyz = r * np.stack((
        co * cu - so * su * math.cos(inc),
        so * cu + co * su * math.cos(inc),
        su * math.sin(inc)
    ), axis=1)

    th = math.radians(float(e["earth_angle0_deg"])) + EARTH_OMEGA * t_s
    c, ss = math.cos(th), math.sin(th)
    rot = np.array([[c, -ss, 0.0], [ss, c, 0.0], [0.0, 0.0, 1.0]], dtype=np.float64)
    fixed = xyz @ rot
    sat_ids = [x["id"] for x in d["satellites"]]
    return sat_ids, xyz, fixed


def ground_position(g: dict) -> np.ndarray:
    """Earth-fixed Cartesian position of a ground site [km]."""
    lat, lon = math.radians(float(g["lat_deg"])), math.radians(float(g["lon_deg"]))
    return EARTH_RADIUS_KM * np.array([
        math.cos(lat) * math.cos(lon),
        math.cos(lat) * math.sin(lon),
        math.sin(lat)
    ], dtype=np.float64)


def ecef_to_geodetic(xyz: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Convert spherical Earth-fixed ECEF coordinates [km] to (lat_deg, lon_deg, alt_km).
    """
    x, y, z = xyz[:, 0], xyz[:, 1], xyz[:, 2]
    hypot_xy = np.hypot(x, y)
    lat_deg = np.degrees(np.arctan2(z, hypot_xy))
    lon_deg = np.degrees(np.arctan2(y, x))
    dist_origin = np.hypot(hypot_xy, z)
    alt_km = dist_origin - EARTH_RADIUS_KM
    return lat_deg, lon_deg, alt_km


def snapshot(s: dict, t_s: float) -> dict:
    """
    Calculate single time frame: satellite positions, active state, ISL and ground edges, elevations.
    Edges are potential bidirectional contacts; ground nodes cannot relay traffic.
    Matches Расчетный модуль/geometry.py snapshot format.
    """
    e, d = (s["environment"], s["design"])
    ids, inertial, xyz = compute_positions(s, t_s)
    
    failed = {f["satellite_id"] for f in s.get("failures", []) if f["start_s"] <= t_s < f["end_s"]}
    active = np.array([
        sat["launch_batch"] <= d["launch_stage"] and sat["id"] not in failed
        for sat in d["satellites"]
    ], dtype=bool)

    # Inter-satellite links (ISL)
    n_sats = len(ids)
    edges: list[list[str | float]] = []
    if n_sats > 1:
        i, j = np.triu_indices(n_sats, 1)
        delta = xyz[j] - xyz[i]
        dist = np.linalg.norm(delta, axis=1)
        denom = np.sum(delta * delta, axis=1)
        lam = np.clip(-np.sum(xyz[i] * delta, axis=1) / np.maximum(denom, 1e-12), 0.0, 1.0)
        closest = np.linalg.norm(xyz[i] + lam[:, None] * delta, axis=1)
        ok = (dist < float(e["isl_range_km"])) & (closest > EARTH_RADIUS_KM) & active[i] & active[j]
        for a, b, dd in zip(i[ok], j[ok], dist[ok]):
            edges.append([ids[a], ids[b], float(dd)])

    # Ground stations links
    elevations: dict[str, dict[str, float]] = {}
    active_indices = np.where(active)[0]
    min_elev = float(e["min_elevation_deg"])

    for g in s.get("ground_sites", []):
        gid = g["id"]
        gp = ground_position(g)
        dif = xyz - gp
        dl = np.linalg.norm(dif, axis=1)
        # clip dot product for numerical stability
        dot = np.clip(dif @ (gp / EARTH_RADIUS_KM) / dl, -1.0, 1.0)
        el = np.degrees(np.arcsin(dot))

        elevations[gid] = {ids[k]: float(el[k]) for k in active_indices}
        
        is_gw = (g.get("role") == "gateway")
        offline = False
        if is_gw:
            offline = any(
                f["gateway_id"] == gid and f["start_s"] <= t_s < f["end_s"]
                for f in s.get("gateway_outages", [])
            )

        vis = (el >= min_elev) & active & (not offline)
        for k in np.where(vis)[0]:
            edges.append([gid, ids[k], float(dl[k])])

    lat_arr, lon_arr, alt_arr = ecef_to_geodetic(xyz)

    satellites_out = []
    for k, sid in enumerate(ids):
        sat_meta = d["satellites"][k]
        satellites_out.append({
            "id": sid,
            "plane_id": sat_meta.get("plane_id"),
            "launch_batch": sat_meta.get("launch_batch"),
            "x_km": float(xyz[k, 0]),
            "y_km": float(xyz[k, 1]),
            "z_km": float(xyz[k, 2]),
            "lat_deg": float(lat_arr[k]),
            "lon_deg": float(lon_arr[k]),
            "alt_km": float(alt_arr[k]),
            "active": bool(active[k]),
            "failed": bool(sid in failed),
        })

    return {
        "t_s": t_s,
        "satellites": satellites_out,
        "edges": edges,
        "elevation_deg": elevations,
    }
