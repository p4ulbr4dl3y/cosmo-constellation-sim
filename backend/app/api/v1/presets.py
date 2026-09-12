from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, status

from app.models.schemas import ErrorResponse, PresetSummary, Scenario

router = APIRouter(tags=["presets"])


def find_data_dir() -> Path:
    """Поиск директории эталонных сценариев 'data' или 'Данные'."""
    names = ["data", "Данные"]
    candidates = []
    for name in names:
        candidates.extend(
            [
                Path.cwd() / name,
                Path.cwd().parent / name,
                Path(__file__).resolve().parents[4] / name,
                Path(__file__).resolve().parents[3] / name,
                Path(__file__).resolve().parents[2] / name,
            ]
        )
    for c in candidates:
        if c.exists() and c.is_dir():
            return c
    return Path("data")


@router.get(
    "/presets",
    response_model=list[PresetSummary],
    summary="Получение списка доступных пресетов сценариев",
)
def get_presets() -> list[PresetSummary]:
    """Возвращает метаданные и параметры доступных файлов сценариев."""
    data_dir = find_data_dir()
    if not data_dir.exists():
        return []

    summaries: list[PresetSummary] = []
    for p in sorted(data_dir.glob("*.json")):
        try:
            content = json.loads(p.read_text(encoding="utf-8"))
            if content.get("schema_version") != "cosmo-A-1.0":
                continue
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


@router.get(
    "/presets/{name}",
    response_model=Scenario | dict[str, Any],
    summary="Получение конфигурации пресета по имени файла",
    responses={
        200: {"description": "Полная спецификация сценария в формате cosmo-A-1.0"},
        404: {"model": ErrorResponse, "description": "Сценарий не найден в каталоге пресетов"},
        500: {"model": ErrorResponse, "description": "Ошибка чтения файла сценария"},
    },
)
def get_preset(name: str) -> dict[str, Any]:
    """Возвращает полное содержимое сценария в формате JSON."""
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
