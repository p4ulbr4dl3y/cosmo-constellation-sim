from __future__ import annotations

import copy
import json
from typing import Any

import pytest

from app.core.validator import validate_scenario
from tests.conftest import resolve_preset_path

pytestmark = pytest.mark.unit


@pytest.mark.unit
@pytest.mark.parametrize(
    "filename",
    [
        "01_full_constellation.json",
        "02_first_launch.json",
        "03_satellite_outages.json",
        "04_link_range.json",
    ],
)
def test_presets_valid(filename: str) -> None:
    path = resolve_preset_path(filename)
    scenario = json.loads(path.read_text(encoding="utf-8"))
    errors = validate_scenario(scenario)
    assert errors == [], f"Preset {filename} failed validation: {errors}"


@pytest.mark.unit
def test_invalid_schema_version(baseline_scenario_data: dict[str, Any]) -> None:
    s = copy.deepcopy(baseline_scenario_data)
    s["schema_version"] = "wrong-version"
    errors = validate_scenario(s)
    assert any("Неподдерживаемая версия схемы" in e for e in errors)


@pytest.mark.unit
def test_invalid_orbit_altitude(baseline_scenario_data: dict[str, Any]) -> None:
    s = copy.deepcopy(baseline_scenario_data)
    s["environment"]["altitude_km"] = 150.0  # < 200
    errors = validate_scenario(s)
    assert any("Недопустимая высота орбиты" in e for e in errors)


@pytest.mark.unit
def test_invalid_time_grid(baseline_scenario_data: dict[str, Any]) -> None:
    s = copy.deepcopy(baseline_scenario_data)
    s["environment"]["horizon_s"] = 86401
    errors = validate_scenario(s)
    assert any("нацело кратен" in e for e in errors)


@pytest.mark.unit
def test_duplicate_satellite_ids(baseline_scenario_data: dict[str, Any]) -> None:
    s = copy.deepcopy(baseline_scenario_data)
    s["design"]["satellites"][1]["id"] = s["design"]["satellites"][0]["id"]
    errors = validate_scenario(s)
    assert any("Дублирующийся идентификатор спутника" in e for e in errors)


@pytest.mark.unit
def test_ground_and_sat_id_collision(baseline_scenario_data: dict[str, Any]) -> None:
    s = copy.deepcopy(baseline_scenario_data)
    sat0_id = s["design"]["satellites"][0]["id"]
    s["ground_sites"][0]["id"] = sat0_id
    errors = validate_scenario(s)
    assert any("совпадает с идентификатором спутника" in e for e in errors)


@pytest.mark.unit
def test_missing_client_role(baseline_scenario_data: dict[str, Any]) -> None:
    s = copy.deepcopy(baseline_scenario_data)
    for g in s["ground_sites"]:
        g["role"] = "gateway"
    errors = validate_scenario(s)
    assert any("хотя бы один клиентский пункт" in e for e in errors)


@pytest.mark.unit
def test_invalid_outage_satellite_id(baseline_scenario_data: dict[str, Any]) -> None:
    s = copy.deepcopy(baseline_scenario_data)
    s["failures"] = [{"satellite_id": "NON_EXISTENT", "start_s": 0, "end_s": 120}]
    errors = validate_scenario(s)
    assert any("неизвестный satellite_id" in e for e in errors)


@pytest.mark.unit
def test_non_dict_collection_items(baseline_scenario_data: dict[str, Any]) -> None:
    s = copy.deepcopy(baseline_scenario_data)
    s["design"]["planes"].append("not-a-dict")
    s["design"]["satellites"].append(123)
    s["ground_sites"].append(None)
    s["failures"].append("fail")
    s["gateway_outages"].append(True)
    errors = validate_scenario(s)
    assert any("должен быть объектом" in e for e in errors)
    assert len(errors) >= 5


@pytest.mark.unit
def test_validation_non_dict_scenario() -> None:
    assert validate_scenario(["not", "a", "dict"]) == [
        "Сценарий должен быть объектом JSON (словарём)."
    ]


@pytest.mark.unit
def test_validation_missing_or_invalid_environment(
    baseline_scenario_data: dict[str, Any],
) -> None:
    s = {"schema_version": "cosmo-A-1.0"}
    errs = validate_scenario(s)
    assert any("Отсутствует обязательный раздел 'environment'" in e for e in errs)

    base = baseline_scenario_data

    # Missing required env key
    s_missing = copy.deepcopy(base)
    del s_missing["environment"]["altitude_km"]
    errs = validate_scenario(s_missing)
    assert any("отсутствует обязательное поле 'altitude_km'" in e for e in errs)

    # Non-finite number in env key
    s_non_finite = copy.deepcopy(base)
    s_non_finite["environment"]["inclination_deg"] = "not_a_number"
    errs = validate_scenario(s_non_finite)
    assert any("должно быть конечным числом" in e for e in errs)

    # Out of bounds altitude (too high)
    s_alt = copy.deepcopy(base)
    s_alt["environment"]["altitude_km"] = 1500.0
    errs = validate_scenario(s_alt)
    assert any("Недопустимая высота орбиты" in e for e in errs)

    # Out of bounds inclination
    s_inc = copy.deepcopy(base)
    s_inc["environment"]["inclination_deg"] = 185.0
    errs = validate_scenario(s_inc)
    assert any("Недопустимое наклонение орбиты" in e for e in errs)

    # Invalid step_s / horizon_s types
    s_type = copy.deepcopy(base)
    s_type["environment"]["step_s"] = "60"
    s_type["environment"]["horizon_s"] = True
    errs = validate_scenario(s_type)
    assert any("step_s должен быть целым положительным числом" in e for e in errs)
    assert any("horizon_s должен быть целым положительным числом" in e for e in errs)

    # Out of bounds time grid
    s_grid = copy.deepcopy(base)
    s_grid["environment"]["step_s"] = 0
    s_grid["environment"]["horizon_s"] = 200000
    errs = validate_scenario(s_grid)
    assert any("Недопустимая временная сетка" in e for e in errs)

    # Min elevation out of bounds
    s_elev = copy.deepcopy(base)
    s_elev["environment"]["min_elevation_deg"] = 95.0
    errs = validate_scenario(s_elev)
    assert any("Недопустимый минимальный угол возвышения" in e for e in errs)

    # ISL range out of bounds
    s_isl = copy.deepcopy(base)
    s_isl["environment"]["isl_range_km"] = -100.0
    errs = validate_scenario(s_isl)
    assert any("Недопустимая дальность ISL" in e for e in errs)

    # Target availability out of bounds
    s_target = copy.deepcopy(base)
    s_target["environment"]["target_availability"] = 1.5
    errs = validate_scenario(s_target)
    assert any("Целевая доступность" in e for e in errs)


@pytest.mark.unit
def test_validation_design_errors(baseline_scenario_data: dict[str, Any]) -> None:
    base = baseline_scenario_data

    # Missing design section
    s_nodes = copy.deepcopy(base)
    del s_nodes["design"]
    errs = validate_scenario(s_nodes)
    assert any("Отсутствует обязательный раздел 'design'" in e for e in errs)

    # Invalid launch_stage
    s_stage = copy.deepcopy(base)
    s_stage["design"]["launch_stage"] = 4
    errs = validate_scenario(s_stage)
    assert any("launch_stage должен быть целым числом 1, 2 или 3" in e for e in errs)

    # Empty / missing planes
    s_noplanes = copy.deepcopy(base)
    s_noplanes["design"]["planes"] = []
    errs = validate_scenario(s_noplanes)
    assert any("Список орбитальных плоскостей 'planes' пуст или отсутствует" in e for e in errs)

    # Plane invalid id and duplicate plane id
    s_plane_err = copy.deepcopy(base)
    s_plane_err["design"]["planes"] = [
        {"id": "", "raan_deg": 0.0, "phase_deg": 0.0},
        {"id": "P1", "raan_deg": 0.0, "phase_deg": 0.0},
        {"id": "P1", "raan_deg": 400.0, "phase_deg": -10.0},
    ]
    errs = validate_scenario(s_plane_err)
    assert any("имеет некорректный id" in e for e in errs)
    assert any("Дублирующийся идентификатор плоскости" in e for e in errs)
    assert any("Недопустимый угол raan_deg" in e for e in errs)
    assert any("Недопустимый угол phase_deg" in e for e in errs)

    # Empty / missing satellites
    s_nosats = copy.deepcopy(base)
    s_nosats["design"]["satellites"] = None
    errs = validate_scenario(s_nosats)
    assert any("Список спутников 'satellites' пуст или отсутствует" in e for e in errs)

    # Satellite invalid id, unknown plane_id, invalid batch, invalid slot_deg
    s_sat_err = copy.deepcopy(base)
    s_sat_err["design"]["satellites"] = [
        {"id": None, "plane_id": "P1", "launch_batch": 1, "slot_deg": 0.0},
        {"id": "SAT_X", "plane_id": "NON_EXISTENT_PLANE", "launch_batch": 5, "slot_deg": "bad"},
    ]
    errs = validate_scenario(s_sat_err)
    assert any("имеет некорректный id" in e for e in errs)
    assert any("ссылается на несуществующую плоскость" in e for e in errs)
    assert any("недопустимый launch_batch" in e for e in errs)
    assert any("некорректный slot_deg" in e for e in errs)


@pytest.mark.unit
def test_validation_ground_sites_errors(baseline_scenario_data: dict[str, Any]) -> None:
    base = baseline_scenario_data

    # Missing ground_sites
    s_noground = copy.deepcopy(base)
    del s_noground["ground_sites"]
    errs = validate_scenario(s_noground)
    assert any("Список наземных пунктов 'ground_sites' пуст или отсутствует" in e for e in errs)

    # Invalid site id, duplicate id, invalid role, invalid lat, invalid lon
    s_sites = copy.deepcopy(base)
    s_sites["ground_sites"] = [
        {"id": "", "role": "client", "lat_deg": 0, "lon_deg": 0},
        {"id": "DUP", "role": "client", "lat_deg": 0, "lon_deg": 0},
        {"id": "DUP", "role": "unknown_role", "lat_deg": 100.0, "lon_deg": -200.0},
    ]
    errs = validate_scenario(s_sites)
    assert any("имеет некорректный id" in e for e in errs)
    assert any("Дублирующийся идентификатор наземного пункта" in e for e in errs)
    assert any("недопустимую роль" in e for e in errs)
    assert any("недопустимую широту" in e for e in errs)
    assert any("недопустимую долготу" in e for e in errs)
    assert any("хотя бы один шлюз" in e for e in errs)


@pytest.mark.unit
def test_validation_failures_and_gateway_outages(
    baseline_scenario_data: dict[str, Any],
) -> None:
    base = baseline_scenario_data

    # failures not a list
    s_f_type = copy.deepcopy(base)
    s_f_type["failures"] = "not-a-list"
    errs = validate_scenario(s_f_type)
    assert any("Поле 'failures' должно быть списком" in e for e in errs)

    # failure non-numeric times and out of bounds
    s_f_bounds = copy.deepcopy(base)
    sid = s_f_bounds["design"]["satellites"][0]["id"]
    s_f_bounds["failures"] = [
        {"satellite_id": sid, "start_s": "bad", "end_s": 100},
        {"satellite_id": sid, "start_s": 200, "end_s": 100},
    ]
    errs = validate_scenario(s_f_bounds)
    assert any("должен содержать числовые start_s и end_s" in e for e in errs)
    assert any("имеет некорректный интервал" in e for e in errs)

    # gateway_outages not a list
    s_gw_type = copy.deepcopy(base)
    s_gw_type["gateway_outages"] = "not-a-list"
    errs = validate_scenario(s_gw_type)
    assert any("Поле 'gateway_outages' должно быть списком" in e for e in errs)

    # gateway outage unknown id, non-numeric times, out of bounds
    gw_id = next(g["id"] for g in base["ground_sites"] if g["role"] == "gateway")
    s_gw_bounds = copy.deepcopy(base)
    s_gw_bounds["gateway_outages"] = [
        {"gateway_id": "UNKNOWN_GW", "start_s": 0, "end_s": 100},
        {"gateway_id": gw_id, "start_s": None, "end_s": 100},
        {"gateway_id": gw_id, "start_s": 500, "end_s": 100},
    ]
    errs = validate_scenario(s_gw_bounds)
    assert any("ссылается на неизвестный gateway_id" in e for e in errs)
    assert any(
        "Интервал недоступности шлюза" in e and "должен содержать числовые" in e for e in errs
    )
    assert any("Период недоступности" in e and "имеет некорректный интервал" in e for e in errs)
