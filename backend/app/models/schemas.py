from __future__ import annotations

from typing import Any, Literal
from pydantic import BaseModel, Field


class ValidateResponse(BaseModel):
    """Результат валидации параметров сценария группировки."""

    valid: bool
    errors: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class SnapshotRequest(BaseModel):
    """Параметры запроса для расчета мгновенного снимка группировки в момент времени t_s."""

    scenario: dict[str, Any]
    t_s: float = 0.0
    routing_metric: Literal["hops", "distance"] = "hops"


class SimulateRequest(BaseModel):
    """Параметры запроса для полного моделирования на интервале времени."""

    scenario: dict[str, Any]
    routing_metric: Literal["hops", "distance"] = "hops"
    include_timeline: bool = True


class ExportRequest(BaseModel):
    """Параметры запроса экспорта результатов расчета в формат cosmo-A-result-1.0."""

    scenario: dict[str, Any]
    routing_metric: Literal["hops", "distance"] = "hops"


class CompareRequest(BaseModel):
    """Параметры запроса для сравнительного анализа двух сценариев."""

    scenario_a: dict[str, Any]
    scenario_b: dict[str, Any]
    routing_metric: Literal["hops", "distance"] = "hops"


class PresetSummary(BaseModel):
    """Краткая сводка предустановленного сценария орбитальной группировки."""

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
    """Параметры орбитальной плоскости группировки."""

    id: str
    raan_deg: float
    phase_deg: float


class ScenarioSatellite(BaseModel):
    """Параметры космического аппарата в орбитальной плоскости."""

    id: str
    plane_id: str
    slot_deg: float
    launch_batch: int


class ScenarioGroundSite(BaseModel):
    """Параметры наземного пункта: клиентский терминал или шлюзовая станция."""

    id: str
    name: str | None = None
    role: Literal["client", "gateway"]
    lat_deg: float
    lon_deg: float


class ScenarioFailure(BaseModel):
    """Интервал времени отказа космического аппарата."""

    satellite_id: str
    start_s: float
    end_s: float


class ScenarioGatewayOutage(BaseModel):
    """Интервал времени отключения наземного шлюза."""

    gateway_id: str
    start_s: float
    end_s: float


class ScenarioEnvironment(BaseModel):
    """Физические и орбитальные параметры моделирования."""

    altitude_km: float
    inclination_deg: float
    earth_angle0_deg: float
    horizon_s: int
    step_s: int
    min_elevation_deg: float
    isl_range_km: float
    target_availability: float


class ScenarioDesign(BaseModel):
    """Конфигурация космического сегмента группировки."""

    launch_stage: int = 3
    planes: list[ScenarioPlane]
    satellites: list[ScenarioSatellite]


class Scenario(BaseModel):
    """Полная структура сценария орбитальной группировки."""

    schema_version: str = "cosmo-A-1.0"
    meta: dict[str, Any] = Field(default_factory=dict)
    environment: ScenarioEnvironment
    design: ScenarioDesign
    ground_sites: list[ScenarioGroundSite]
    failures: list[ScenarioFailure] = Field(default_factory=list)
    gateway_outages: list[ScenarioGatewayOutage] = Field(default_factory=list)
