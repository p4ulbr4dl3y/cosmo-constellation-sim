from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Generator

from fastapi.testclient import TestClient
import pytest

from app.main import app
from app.models.schemas import Scenario


def get_data_dir() -> Path:
    candidates = [
        Path.cwd() / "data",
        Path.cwd().parent / "data",
        Path(__file__).resolve().parents[2] / "data",
        Path(__file__).resolve().parents[1] / "data",
        Path.cwd() / "Данные",
        Path.cwd().parent / "Данные",
        Path(__file__).resolve().parents[2] / "Данные",
        Path(__file__).resolve().parents[1] / "Данные",
    ]
    for c in candidates:
        if c.exists() and c.is_dir():
            return c
    raise FileNotFoundError("Data directory not found")


def resolve_preset_path(name: str) -> Path:
    candidates = [
        Path.cwd() / "data" / name,
        Path.cwd().parent / "data" / name,
        Path(__file__).resolve().parents[2] / "data" / name,
        Path(__file__).resolve().parents[1] / "data" / name,
        Path.cwd() / "Данные" / name,
        Path.cwd().parent / "Данные" / name,
        Path(__file__).resolve().parents[2] / "Данные" / name,
        Path(__file__).resolve().parents[1] / "Данные" / name,
    ]
    for c in candidates:
        if c.exists() and c.is_file():
            return c
    data_dir = get_data_dir()
    candidate = data_dir / name
    if candidate.exists():
        return candidate
    raise FileNotFoundError(f"Preset {name} not found")


@pytest.fixture(scope="session")
def baseline_scenario_path() -> Path:
    """Path to ../data/01_full_constellation.json."""
    return resolve_preset_path("01_full_constellation.json")


@pytest.fixture
def baseline_scenario_data(baseline_scenario_path: Path) -> dict[str, Any]:
    """Parsed dictionary from baseline JSON."""
    return json.loads(baseline_scenario_path.read_text(encoding="utf-8"))


@pytest.fixture
def baseline_scenario(baseline_scenario_data: dict[str, Any]) -> Scenario:
    """Validated Scenario schema instance."""
    return Scenario.model_validate(baseline_scenario_data)


@pytest.fixture
def api_client() -> Generator[TestClient, None, None]:
    """FastAPI TestClient(app) fixture."""
    with TestClient(app) as client:
        yield client
