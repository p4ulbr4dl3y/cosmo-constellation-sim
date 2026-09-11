import json
from pathlib import Path
import pytest

from app.core.validator import validate_scenario


def get_preset_path(name: str) -> Path:
    candidates = [
        Path.cwd() / "Данные" / name,
        Path.cwd().parent / "Данные" / name,
        Path(__file__).resolve().parents[2] / "Данные" / name,
        Path(__file__).resolve().parents[1] / "Данные" / name,
    ]
    for c in candidates:
        if c.exists():
            return c
    raise FileNotFoundError(f"Preset {name} not found")


@pytest.mark.parametrize(
    "filename",
    [
        "01_full_constellation.json",
        "02_first_launch.json",
        "03_satellite_outages.json",
        "04_link_range.json",
    ],
)
def test_presets_valid(filename: str):
    path = get_preset_path(filename)
    scenario = json.loads(path.read_text(encoding="utf-8"))
    errors = validate_scenario(scenario)
    assert errors == [], f"Preset {filename} failed validation: {errors}"


def test_invalid_schema_version():
    path = get_preset_path("01_full_constellation.json")
    s = json.loads(path.read_text(encoding="utf-8"))
    s["schema_version"] = "wrong-version"
    errors = validate_scenario(s)
    assert any("Неподдерживаемая версия схемы" in e for e in errors)


def test_invalid_orbit_altitude():
    path = get_preset_path("01_full_constellation.json")
    s = json.loads(path.read_text(encoding="utf-8"))
    s["environment"]["altitude_km"] = 150.0  # < 200
    errors = validate_scenario(s)
    assert any("Недопустимая высота орбиты" in e for e in errors)


def test_invalid_time_grid():
    path = get_preset_path("01_full_constellation.json")
    s = json.loads(path.read_text(encoding="utf-8"))
    s["environment"]["horizon_s"] = 86401
    errors = validate_scenario(s)
    assert any("нацело кратен" in e for e in errors)


def test_duplicate_satellite_ids():
    path = get_preset_path("01_full_constellation.json")
    s = json.loads(path.read_text(encoding="utf-8"))
    s["design"]["satellites"][1]["id"] = s["design"]["satellites"][0]["id"]
    errors = validate_scenario(s)
    assert any("Дублирующийся идентификатор спутника" in e for e in errors)


def test_ground_and_sat_id_collision():
    path = get_preset_path("01_full_constellation.json")
    s = json.loads(path.read_text(encoding="utf-8"))
    sat0_id = s["design"]["satellites"][0]["id"]
    s["ground_sites"][0]["id"] = sat0_id
    errors = validate_scenario(s)
    assert any("совпадает с идентификатором спутника" in e for e in errors)


def test_missing_client_role():
    path = get_preset_path("01_full_constellation.json")
    s = json.loads(path.read_text(encoding="utf-8"))
    for g in s["ground_sites"]:
        g["role"] = "gateway"
    errors = validate_scenario(s)
    assert any("хотя бы один клиентский пункт" in e for e in errors)


def test_invalid_outage_satellite_id():
    path = get_preset_path("01_full_constellation.json")
    s = json.loads(path.read_text(encoding="utf-8"))
    s["failures"] = [{"satellite_id": "NON_EXISTENT", "start_s": 0, "end_s": 120}]
    errors = validate_scenario(s)
    assert any("неизвестный satellite_id" in e for e in errors)


def test_non_dict_collection_items():
    path = get_preset_path("01_full_constellation.json")
    s = json.loads(path.read_text(encoding="utf-8"))
    s["design"]["planes"].append("not-a-dict")
    s["design"]["satellites"].append(123)
    s["ground_sites"].append(None)
    s["failures"].append("fail")
    s["gateway_outages"].append(True)
    errors = validate_scenario(s)
    assert any("должен быть объектом" in e for e in errors)
    assert len(errors) >= 5
