from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.analysis import router as analysis_router
from app.api.v1.presets import router as presets_router
from app.api.v1.simulation import router as simulation_router

router = APIRouter()

router.include_router(presets_router)
router.include_router(simulation_router)
router.include_router(analysis_router)

__all__ = ["router"]
