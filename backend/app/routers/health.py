"""Health check endpoint."""

from fastapi import APIRouter

router = APIRouter()


@router.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "service": "Beauty Without Boundaries (美妆无界)",
        "version": "1.0.0",
    }
