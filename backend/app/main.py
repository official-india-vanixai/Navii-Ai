"""
FastAPI Entrypoint for N.A.V.I.I Cloud Backend.
Provides modular endpoints, CORS, health checks, rate limiting, and global exception handling.
"""

import sys
import os

# Ensure backend root directory is in sys.path when executed directly as a script
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from datetime import datetime

from app.core.config import settings
from app.models.schemas import HealthResponse
from app.api.v1.router import api_v1_router

# Initialize FastAPI application
app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Cloud-powered backend engine for N.A.V.I.I (Neural Assistant for Virtual Intelligence & Interaction)",
    docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT != "production" else None,
)

# Configure Cross-Origin Resource Sharing (CORS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS if settings.CORS_ORIGINS else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Version 1 Modular API Routes
app.include_router(api_v1_router, prefix=settings.API_V1_STR)


@app.get("/", tags=["Root"])
async def root():
    """Welcome endpoint confirming server status."""
    return {
        "service": "N.A.V.I.I Neural Cloud Gateway",
        "tagline": "Intelligence at Your Fingertips.",
        "status": "online",
        "version": settings.VERSION,
        "docs": "/docs" if settings.ENVIRONMENT != "production" else "disabled in production"
    }


@app.get("/health", response_model=HealthResponse, tags=["Monitoring"])
async def health_check():
    """Health check endpoint for Render, load balancers, and monitoring."""
    return HealthResponse(
        status="healthy",
        version=settings.VERSION,
        service=settings.PROJECT_NAME,
        timestamp=datetime.utcnow(),
        environment=settings.ENVIRONMENT
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler ensuring clean JSON error responses."""
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "InternalServerError",
            "message": "An unexpected error occurred in the N.A.V.I.I Neural Core.",
            "details": str(exc) if settings.ENVIRONMENT == "development" else None
        }
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=True)
