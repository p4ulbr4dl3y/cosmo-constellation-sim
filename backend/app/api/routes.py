from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, status

from app.core.compare import compare_scenarios
from app.core.export import export_result
from app.core.geometry import ground_position, snapshot
from app.core.routing import build_adjacency, classify_failure, find_route
from app.core.simulator import run_simulation
from app.core.validator import validate_scenario
from app.models.schemas import (
    CompareRequest,
    ExportRequest,
    PresetSummary,
    SimulateRequest,
    SnapshotRequest,
    ValidateResponse,
)

router = APIRouter()


def find_data_dir() -> Path:
    """Locate 'Данные' directory across development and test environments."""
    candidates = [
        Path.cwd() / "Данные",
        Path.cwd().parent / "Данные",
        Path(__file__).resolve().parents[3] / "Данные",
        Path(__file__).resolve().parents[2] / "Данные",
    ]
    for c in candidates:
        if c.exists() and c.is_dir():
            return c
    # Fallback to local
    return Path("Данные")


@router.get("/health", summary="Health check")
def get_health() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "satellite-constellation-backend",
        "version": "0.1.0",
    }


@router.get(
    "/presets",
    response_model=list[PresetSummary],
    summary="List available scenario presets",
)
def get_presets() -> list[PresetSummary]:
    data_dir = find_data_dir()
    if not data_dir.exists():
        return []

    summaries: list[PresetSummary] = []
    for p in sorted(data_dir.glob("*.json")):
        try:
            content = json.loads(p.read_text(encoding="utf-8"))
            meta = content.get("meta", {})
            env = content.get("environment", {})
            des = content.get("design", {})
            ground = content.get("ground_sites", [])

            client_count = sum(1 for g in ground if g.get("role") == "client")
            gateway_count = sum(1 for g in ground if g.get("role") == "gateway")

            summaries.append(
                PresetSummary(
                    id=meta.get("id", p.stem),
                    title=meta.get("title", p.name),
                    filename=p.name,
                    satellite_count=len(des.get("satellites", [])),
                    planes_count=len(des.get("planes", [])),
                    client_count=client_count,
                    gateway_count=gateway_count,
                    horizon_s=int(env.get("horizon_s", 86400)),
                    step_s=int(env.get("step_s", 120)),
                    launch_stage=int(des.get("launch_stage", 3)),
                    isl_range_km=float(env.get("isl_range_km", 3000.0)),
                )
            )
        except Exception:
            continue

    return summaries


@router.get("/presets/{name}", summary="Get scenario preset JSON by name")
def get_preset(name: str) -> dict[str, Any]:
    data_dir = find_data_dir()
    filename = name if name.endswith(".json") else f"{name}.json"
    preset_path = data_dir / filename

    if not preset_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Сценарий '{name}' не найден в каталоге пресетов.",
        )

    try:
        return json.loads(preset_path.read_text(encoding="utf-8"))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка чтения файла сценария: {e}",
        )


@router.post(
    "/validate", response_model=ValidateResponse, summary="Validate scenario body"
)
def validate(scenario: dict[str, Any]) -> ValidateResponse:
    errors = validate_scenario(scenario)
    return ValidateResponse(valid=len(errors) == 0, errors=errors)


@router.post("/simulate", summary="Run full time-horizon simulation")
def simulate(req: SimulateRequest) -> dict[str, Any]:
    errors = validate_scenario(req.scenario)
    if errors:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"message": "Сценарий содержит ошибки валидации", "errors": errors},
        )

    result = run_simulation(
        scenario=req.scenario,
        metric=req.routing_metric,
        include_timeline=req.include_timeline,
    )
    return result


@router.post("/snapshot", summary="Compute single time snapshot for visualizer/map")
def compute_snapshot(req: SnapshotRequest) -> dict[str, Any]:
    scenario = req.scenario
    t_s = float(req.t_s)
    metric = req.routing_metric

    errors = validate_scenario(scenario)
    if errors:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"message": "Сценарий содержит ошибки валидации", "errors": errors},
        )

    snap = snapshot(scenario, t_s)
    adj = build_adjacency(snap["edges"])

    ground = scenario.get("ground_sites", [])
    clients = [g["id"] for g in ground if g.get("role") == "client"]
    all_clients_set = set(clients)
    gateways = [g["id"] for g in ground if g.get("role") == "gateway"]
    all_gw_set = set(gateways)
    gw_outages = scenario.get("gateway_outages", [])

    cur_gw_outages = {
        f["gateway_id"] for f in gw_outages if f["start_s"] <= t_s < f["end_s"]
    }
    online_gateways = {gid for gid in all_gw_set if gid not in cur_gw_outages}

    # Gateway sat visibility
    gw_has_sat = False
    for gid in online_gateways:
        if any(nxt not in all_gw_set for nxt, _ in adj.get(gid, [])):
            gw_has_sat = True
            break

    # Ground sites with Cartesian and online status
    ground_sites_out = []
    for g in ground:
        gid = g["id"]
        gp = ground_position(g)
        is_gw = g.get("role") == "gateway"
        is_online = (gid not in cur_gw_outages) if is_gw else True
        ground_sites_out.append(
            {
                "id": gid,
                "name": g.get("name", gid),
                "role": g.get("role"),
                "lat_deg": float(g.get("lat_deg")),
                "lon_deg": float(g.get("lon_deg")),
                "x_km": float(gp[0]),
                "y_km": float(gp[1]),
                "z_km": float(gp[2]),
                "online": is_online,
            }
        )

    # Client routes and statuses
    client_routes: dict[str, Any] = {}
    clients_connected = 0

    for cid in clients:
        client_visible_sats = [
            nxt
            for nxt, _ in adj.get(cid, [])
            if nxt not in all_clients_set and nxt not in all_gw_set
        ]
        has_client_sat = len(client_visible_sats) > 0

        path, total_dist = find_route(
            adj=adj,
            client_id=cid,
            online_gateways=online_gateways,
            all_clients=all_clients_set,
            metric=metric,
        )

        has_path = len(path) > 0
        if has_path:
            clients_connected += 1
            client_routes[cid] = {
                "client_id": cid,
                "status": "ok",
                "path": path,
                "hops": len(path) - 1,
                "distance_km": round(total_dist, 2),
                "failure_code": None,
                "failure_reason": None,
            }
        else:
            fail_code, fail_desc = classify_failure(
                has_client_satellite=has_client_sat,
                online_gateways_count=len(online_gateways),
                has_gateway_satellite=gw_has_sat,
            )
            client_routes[cid] = {
                "client_id": cid,
                "status": "outage",
                "path": [],
                "hops": 0,
                "distance_km": 0.0,
                "failure_code": fail_code,
                "failure_reason": fail_desc,
            }

    # Typed edges for visualization
    typed_edges = []
    sat_ids_set = {s["id"] for s in snap["satellites"]}
    for u, v, d in snap["edges"]:
        u_str, v_str = str(u), str(v)
        is_isl = u_str in sat_ids_set and v_str in sat_ids_set
        typed_edges.append(
            {
                "source": u_str,
                "target": v_str,
                "distance_km": round(float(d), 2),
                "type": "isl" if is_isl else "ground",
            }
        )

    active_sats = sum(1 for s in snap["satellites"] if s["active"])
    failed_sats = sum(1 for s in snap["satellites"] if s["failed"])

    return {
        "t_s": t_s,
        "satellites": snap["satellites"],
        "ground_sites": ground_sites_out,
        "edges": typed_edges,
        "elevation_deg": snap["elevation_deg"],
        "client_routes": client_routes,
        "summary": {
            "total_satellites": len(snap["satellites"]),
            "active_satellites": active_sats,
            "failed_satellites": failed_sats,
            "isl_links_count": sum(1 for e in typed_edges if e["type"] == "isl"),
            "ground_links_count": sum(1 for e in typed_edges if e["type"] == "ground"),
            "clients_total": len(clients),
            "clients_connected": clients_connected,
            "clients_outage": len(clients) - clients_connected,
        },
    }


@router.post("/export", summary="Export result in cosmo-A-result-1.0 format")
def export(req: ExportRequest) -> dict[str, Any]:
    errors = validate_scenario(req.scenario)
    if errors:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"message": "Сценарий содержит ошибки валидации", "errors": errors},
        )

    return export_result(scenario=req.scenario, metric=req.routing_metric)


@router.post("/compare", summary="Compare two scenarios")
def compare(req: CompareRequest) -> dict[str, Any]:
    errors_a = validate_scenario(req.scenario_a)
    if errors_a:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "message": "Сценарий A содержит ошибки валидации",
                "errors": errors_a,
            },
        )

    errors_b = validate_scenario(req.scenario_b)
    if errors_b:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "message": "Сценарий B содержит ошибки валидации",
                "errors": errors_b,
            },
        )

    return compare_scenarios(
        scenario_a=req.scenario_a,
        scenario_b=req.scenario_b,
        metric=req.routing_metric,
    )
