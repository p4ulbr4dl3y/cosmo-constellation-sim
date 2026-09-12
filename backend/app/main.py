from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router as api_router
from app.models.schemas import RootResponse

tags_metadata = [
    {
        "name": "simulation",
        "description": "Моделирование динамики группировки, валидация сценариев, расчет снимков ECEF и экспорт результатов.",
    },
    {
        "name": "analysis",
        "description": "Сравнительный анализ сценариев, выявление узких мест и генерация инженерных рекомендаций.",
    },
    {
        "name": "presets",
        "description": "Управление эталонными сценариями группировки и загрузка предустановленных конфигураций.",
    },
]

app = FastAPI(
    title="Созвездие - API моделирования LEO группировки",
    description=(
        "Инженерный REST API для моделирования низкоорбитального созвездия LEO (48 аппаратов, 3 плоскости), "
        "межспутниковых линий связи, динамической маршрутизации Дейкстры и анализа надежности связи "
        "в Арктической зоне РФ."
    ),
    version="0.1.0",
    openapi_tags=tags_metadata,
)

# Разрешение CORS для клиентских веб-приложений
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")


@app.get(
    "/",
    response_model=RootResponse,
    summary="Корневой эндпоинт метаданных сервиса",
    tags=["presets"],
)
def root() -> dict[str, str]:
    """Возвращает информацию о сервисе и ссылки на документацию."""
    return {
        "service": "cosmo-constellation-backend",
        "docs": "/docs",
        "health": "/api/health",
    }
