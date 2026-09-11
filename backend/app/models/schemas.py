from __future__ import annotations

from typing import Any, Literal
from pydantic import BaseModel, Field


class ValidateResponse(BaseModel):
    valid: bool
    errors: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class SnapshotRequest(BaseModel):
    scenario: dict[str, Any]
    t_s: float = 0.0
    routing_metric: Literal["hops", "distance"] = "hops"


class SimulateRequest(BaseModel):
    scenario: dict[str, Any]
    routing_metric: Literal["hops", "distance"] = "hops"
    include_timeline: bool = True


class ExportRequest(BaseModel):
    scenario: dict[str, Any]
    routing_metric: Literal["hops", "distance"] = "hops"


class CompareRequest(BaseModel):
    scenario_a: dict[str, Any]
    scenario_b: dict[str, Any]
    routing_metric: Literal["hops", "distance"] = "hops"


class PresetSummary(BaseModel):
    id: str
    title: str
    filename: str
    satellite_count: int
    planes_count: int
    client_count: int
    gateway_count: int
    horizon_s: int
    step_s: int
    launch_stage: int
    isl_range_km: float


class ScenarioPlane(BaseModel):
    id: str
    raan_deg: float
    phase_deg: float


class ScenarioSatellite(BaseModel):
    id: str
    plane_id: str
    slot_deg: float
    launch_batch: int


class ScenarioGroundSite(BaseModel):
    id: str
    name: str | None = None
    role: Literal["client", "gateway"]
    lat_deg: float
    lon_deg: float


class ScenarioFailure(BaseModel):
    satellite_id: str
    start_s: float
    end_s: float


class ScenarioGatewayOutage(BaseModel):
    gateway_id: str
    start_s: float
    end_s: float


class ScenarioEnvironment(BaseModel):
    altitude_km: float
    inclination_deg: float
    earth_angle0_deg: float
    horizon_s: int
    step_s: int
    min_elevation_deg: float
    isl_range_km: float
    target_availability: float


class ScenarioDesign(BaseModel):
    launch_stage: int = 3
    planes: list[ScenarioPlane]
    satellites: list[ScenarioSatellite]


class Scenario(BaseModel):
    schema_version: str = "cosmo-A-1.0"
    meta: dict[str, Any] = Field(default_factory=dict)
    environment: ScenarioEnvironment
    design: ScenarioDesign
    ground_sites: list[ScenarioGroundSite]
    failures: list[ScenarioFailure] = Field(default_factory=list)
    gateway_outages: list[ScenarioGatewayOutage] = Field(default_factory=list)
