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
