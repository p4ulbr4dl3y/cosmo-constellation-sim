from __future__ import annotations

import math
import numpy as np

from app.core.constants import EARTH_OMEGA, EARTH_RADIUS_KM, EARTH_MU


def finite(x: object) -> bool:
    """Проверка, является ли значение конечным числом."""
    return isinstance(x, (int, float)) and (not isinstance(x, bool)) and math.isfinite(x)


def compute_positions(s: dict, t_s: float) -> tuple[list[str], np.ndarray, np.ndarray]:
    """
    Вычисление координат спутников на момент времени t_s.

    Возвращает кортеж:
    - список идентификаторов спутников;
    - массив координат в инерциальной системе ECI [км];
    - массив координат во вращающейся геоцентрической системе ECEF [км].
    """
    e, d = (s["environment"], s["design"])
    pmap = {p["id"]: p for p in d["planes"]}
    r = EARTH_RADIUS_KM + float(e["altitude_km"])
    # Среднее движение на круговой орбите радиуса r
    n = math.sqrt(EARTH_MU / r**3)
    inc = math.radians(float(e["inclination_deg"]))

    # Аргумент широты спутников: фазирование внутри плоскости и движение по орбите за время t_s
    u = np.array(
        [
            math.radians(float(x["slot_deg"]) + float(pmap[x["plane_id"]]["phase_deg"])) + n * t_s
            for x in d["satellites"]
        ],
        dtype=np.float64,
    )
    om = np.array(
        [math.radians(float(pmap[x["plane_id"]]["raan_deg"])) for x in d["satellites"]],
        dtype=np.float64,
    )

    cu, su, co, so = np.cos(u), np.sin(u), np.cos(om), np.sin(om)
    # Координаты спутников в инерциальной системе ECI
    xyz = r * np.stack(
        (
            co * cu - so * su * math.cos(inc),
            so * cu + co * su * math.cos(inc),
            su * math.sin(inc),
        ),
        axis=1,
    )

    # Вращение Земли вокруг оси Z: переход от инерциальной ECI к геоцентрической ECEF
    th = math.radians(float(e["earth_angle0_deg"])) + EARTH_OMEGA * t_s
    c, ss = math.cos(th), math.sin(th)
    rot = np.array([[c, -ss, 0.0], [ss, c, 0.0], [0.0, 0.0, 1.0]], dtype=np.float64)
    fixed = xyz @ rot
    sat_ids = [x["id"] for x in d["satellites"]]
    return sat_ids, xyz, fixed


def ground_position(g: dict) -> np.ndarray:
    """Вычисление декартовых координат наземного пункта в системе ECEF [км]."""
    lat, lon = math.radians(float(g["lat_deg"])), math.radians(float(g["lon_deg"]))
    return EARTH_RADIUS_KM * np.array(
        [math.cos(lat) * math.cos(lon), math.cos(lat) * math.sin(lon), math.sin(lat)],
        dtype=np.float64,
    )


def ecef_to_geodetic(xyz: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Преобразование координат ECEF [км] в геодезические величины.

    Возвращает кортеж:
    - широта в градусах;
    - долгота в градусах;
    - высота над поверхностью Земли в километрах.
    """
    x, y, z = xyz[:, 0], xyz[:, 1], xyz[:, 2]
    hypot_xy = np.hypot(x, y)
    lat_deg = np.degrees(np.arctan2(z, hypot_xy))
    lon_deg = np.degrees(np.arctan2(y, x))
    dist_origin = np.hypot(hypot_xy, z)
    alt_km = dist_origin - EARTH_RADIUS_KM
    return lat_deg, lon_deg, alt_km


def snapshot(s: dict, t_s: float, fast_edges_only: bool = False) -> dict:
    """
    Расчет состояния группировки в момент времени t_s.

    Определяет:
    - пространственное положение и признак активности спутников;
    - ребра межспутниковых линий связи с проверкой дальности и затенения Землей;
    - видимость и углы места относительно наземных станций;
    - ребра связи между наземными пунктами и спутниками.
    """
    e, d = (s["environment"], s["design"])
    ids, inertial, xyz = compute_positions(s, t_s)

    failed = {f["satellite_id"] for f in s.get("failures", []) if f["start_s"] <= t_s < f["end_s"]}
    active = np.array(
        [
            sat["launch_batch"] <= d["launch_stage"] and sat["id"] not in failed
            for sat in d["satellites"]
        ],
        dtype=bool,
    )

    # Межспутниковые линии связи
    n_sats = len(ids)
    edges: list[list[str | float]] = []
    if n_sats > 1:
        i, j = np.triu_indices(n_sats, 1)
        both_active = active[i] & active[j]
        i_cand = i[both_active]
        j_cand = j[both_active]
        if len(i_cand) > 0:
            delta = xyz[j_cand] - xyz[i_cand]
            denom = np.sum(delta * delta, axis=1)
            isl_range = float(e["isl_range_km"])
            isl_range_sq = isl_range * isl_range
            range_ok = denom < isl_range_sq
            if np.any(range_ok):
                i_sub = i_cand[range_ok]
                j_sub = j_cand[range_ok]
                delta_sub = delta[range_ok]
                denom_sub = denom[range_ok]
                dist_sub = np.sqrt(denom_sub)
                # Проекция центра Земли на отрезок между спутниками для проверки затенения
                lam = np.clip(
                    -np.sum(xyz[i_sub] * delta_sub, axis=1) / np.maximum(denom_sub, 1e-12),
                    0.0,
                    1.0,
                )
                closest = np.linalg.norm(xyz[i_sub] + lam[:, None] * delta_sub, axis=1)
                ok = (dist_sub < isl_range) & (closest > EARTH_RADIUS_KM)
                for a, b, dd in zip(i_sub[ok], j_sub[ok], dist_sub[ok]):
                    edges.append([ids[a], ids[b], float(dd)])

    # Линии связи с наземными станциями
    elevations: dict[str, dict[str, float]] = {}
    active_indices = np.where(active)[0]
    min_elev = float(e["min_elevation_deg"])

    for g in s.get("ground_sites", []):
        gid = g["id"]
        gp = ground_position(g)
        dif = xyz - gp
        dl = np.linalg.norm(dif, axis=1)
        # Ограничение скалярного произведения для численной устойчивости
        dot = np.clip(dif @ (gp / EARTH_RADIUS_KM) / dl, -1.0, 1.0)
        el = np.degrees(np.arcsin(dot))

        elevations[gid] = {ids[k]: float(el[k]) for k in active_indices}

        is_gw = g.get("role") == "gateway"
        offline = False
        if is_gw:
            offline = any(
                f["gateway_id"] == gid and f["start_s"] <= t_s < f["end_s"]
                for f in s.get("gateway_outages", [])
            )

        vis = (el >= min_elev) & active & (not offline)
        for k in np.where(vis)[0]:
            edges.append([gid, ids[k], float(dl[k])])

    if fast_edges_only:
        return {
            "t_s": t_s,
            "satellites": [],
            "edges": edges,
            "elevation_deg": elevations,
        }

    lat_arr, lon_arr, alt_arr = ecef_to_geodetic(xyz)

    satellites_out = []
    for k, sid in enumerate(ids):
        sat_meta = d["satellites"][k]
        satellites_out.append(
            {
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
            }
        )

    return {
        "t_s": t_s,
        "satellites": satellites_out,
        "edges": edges,
        "elevation_deg": elevations,
    }
