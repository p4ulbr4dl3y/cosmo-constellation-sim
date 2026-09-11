from __future__ import annotations

from fastapi import APIRouter

from app.api.v1 import router as v1_router

router = APIRouter()


@router.get("/health", summary="Health check")
def get_health() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "satellite-constellation-backend",
        "version": "0.1.0",
    }


router.include_router(v1_router, prefix="/v1")
router.include_router(v1_router)

__all__ = ["router"]
