"""FastAPI application entry point with CORS, routers, and startup logic."""

import json
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, engine

# Create all tables on startup
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="美妆无界 (Beauty Without Boundaries)",
    description="L'Oréal hackathon multimodal beauty experience platform",
    version="1.0.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Load seed data into memory ──────────────────────────────────────

DATA_DIR = Path(__file__).parent / "data"

_products_db: list[dict] = []
_shades_db: list[dict] = []


def _load_seed_data():
    global _products_db, _shades_db
    try:
        with open(DATA_DIR / "products.json", encoding="utf-8") as f:
            _products_db = json.load(f)
        with open(DATA_DIR / "shades.json", encoding="utf-8") as f:
            _shades_db = json.load(f)
    except FileNotFoundError:
        _products_db = []
        _shades_db = []


_load_seed_data()


def get_products_db() -> list[dict]:
    return _products_db


def get_shades_db() -> list[dict]:
    return _shades_db


# ── Register routers ────────────────────────────────────────────────

from app.routers.health import router as health_router
from app.routers.makeup import router as makeup_router
from app.routers.analysis import router as analysis_router
from app.routers.color_vision import router as color_vision_router
from app.routers.products import router as products_router

app.include_router(health_router)
app.include_router(makeup_router, prefix="/api/makeup", tags=["makeup"])
app.include_router(analysis_router, prefix="/api/analysis", tags=["analysis"])
app.include_router(color_vision_router, prefix="/api/color-vision", tags=["color-vision"])
app.include_router(products_router, prefix="/api/products", tags=["products"])
