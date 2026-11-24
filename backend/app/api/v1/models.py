"""
Model Discovery and Health API for N.A.V.I.I.
Provides live status, specialties, and capabilities for the 5 verified FREE OpenRouter models.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Dict, Any

from app.core.security import get_current_user
from app.core.rate_limit import rate_limiter
from app.models.schemas import UserProfile
from app.services.openrouter_service import openrouter_service, FREE_MODELS

router = APIRouter(prefix="/models", tags=["AI Models & Routing"])


@router.get("", response_model=Dict[str, Any])
async def list_available_models(
    current_user: UserProfile = Depends(get_current_user)
):
    """
    Returns verified free models, active routing modes, and daily quota info.
    Checks live OpenRouter API availability before reporting.
    """
    live_models = await openrouter_service.get_available_models()
    remaining_daily = rate_limiter.get_remaining_daily(current_user.id)

    orchestration_modes = [
        {
            "id": "smart",
            "name": "Smart Mode",
            "badge": "Smart (Auto-Routing)",
            "tag": "AUTO",
            "type": "orchestration",
            "description": "Automatically routes prompts to the optimal free model based on task type.",
            "is_online": True
        },
        {
            "id": "multi",
            "name": "Multi-AI Mode",
            "badge": "Multi-AI Ensemble",
            "tag": "ENSEMBLE",
            "type": "orchestration",
            "description": "Runs parallel consensus between Google Gemma 4 and NVIDIA Nemotron Ultra.",
            "is_online": True
        }
    ]

    return {
        "status": "success",
        "provider": "OpenRouter (Free Tier Only)",
        "models": live_models,
        "modes": orchestration_modes,
        "daily_remaining": remaining_daily,
        "daily_quota": rate_limiter.daily_limit
    }


@router.get("/health", response_model=Dict[str, Any])
async def check_models_health():
    """
    Live connectivity check against OpenRouter gateway.
    """
    try:
        models = await openrouter_service.get_available_models()
        online_count = sum(1 for m in models if m.get("is_online"))
        return {
            "status": "online" if online_count > 0 else "degraded",
            "provider": "OpenRouter",
            "total_free_models": len(models),
            "online_models": online_count,
            "error_tracking": openrouter_service.error_tracker
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"OpenRouter Gateway health check failed: {str(e)}"
        )
