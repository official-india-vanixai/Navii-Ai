"""
Master V1 API Router Aggregator for N.A.V.I.I.
Includes all modular sub-routers under /api/v1.
"""

from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.chat import router as chat_router
from app.api.v1.models import router as models_router
from app.api.v1.voice import router as voice_router
from app.api.v1.files import router as files_router
from app.api.v1.search import router as search_router

api_v1_router = APIRouter()

api_v1_router.include_router(auth_router)
api_v1_router.include_router(chat_router)
api_v1_router.include_router(models_router)
api_v1_router.include_router(voice_router)
api_v1_router.include_router(files_router)
api_v1_router.include_router(search_router)
