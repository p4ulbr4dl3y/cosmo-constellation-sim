from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router as api_router

app = FastAPI(
    title="Cosmo Satellite Constellation API",
    description="Backend service for satellite constellation simulation, routing and resilience analysis (CosmoHack 2026).",
    version="0.1.0",
)

# Enable CORS for frontend clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")


@app.get("/")
def root() -> dict[str, str]:
    return {
        "service": "cosmo-constellation-backend",
        "docs": "/docs",
        "health": "/api/health",
    }
