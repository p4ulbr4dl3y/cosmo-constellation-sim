from __future__ import annotations

from fastapi import APIRouter

from app.api.v1 import router as v1_router
from app.models.schemas import HealthResponse

router = APIRouter()


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Проверка работоспособности сервиса",
    tags=["presets"],
)
def get_health() -> dict[str, str]:
    """Возвращает текущее рабочее состояние сервиса бэкенда и версию сборки."""
    return {
        "status": "ok",
        "service": "satellite-constellation-backend",
        "version": "0.1.0",
    }


router.include_router(v1_router, prefix="/v1")
router.include_router(v1_router)

__all__ = ["router"]
