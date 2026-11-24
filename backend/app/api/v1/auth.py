"""
Authentication, User Profile, and Preferences Endpoints.
"""

from fastapi import APIRouter, Depends
from app.core.security import get_current_user
from app.models.schemas import UserProfile, UserSettings, UserSettingsUpdate, UsageSummaryResponse
from app.services.usage_service import usage_service

router = APIRouter(prefix="/auth", tags=["Authentication & User"])

# In-memory mock settings store (synced to Supabase user_settings table in Phase 6)
_user_settings_cache = {}


@router.get("/me", response_model=UserProfile)
async def get_my_profile(current_user: UserProfile = Depends(get_current_user)):
    """Fetches the authenticated user profile."""
    return current_user


@router.get("/settings", response_model=UserSettings)
async def get_my_settings(current_user: UserProfile = Depends(get_current_user)):
    """Fetches current user preferences."""
    if current_user.id not in _user_settings_cache:
        _user_settings_cache[current_user.id] = UserSettings(
            user_id=current_user.id,
            theme="dark",
            ai_model="gpt-4o",
            voice_name="alloy",
            voice_speed=1.0,
            auto_tts=False,
            sound_effects=True
        )
    return _user_settings_cache[current_user.id]


@router.put("/settings", response_model=UserSettings)
async def update_my_settings(
    updates: UserSettingsUpdate,
    current_user: UserProfile = Depends(get_current_user)
):
    """Updates user preferences (theme, voice, model)."""
    current = await get_my_settings(current_user)
    updated_dict = current.model_dump()
    for key, val in updates.model_dump(exclude_unset=True).items():
        if val is not None:
            updated_dict[key] = val

    updated_settings = UserSettings(**updated_dict)
    _user_settings_cache[current_user.id] = updated_settings
    return updated_settings


@router.get("/usage", response_model=UsageSummaryResponse)
async def get_my_usage(current_user: UserProfile = Depends(get_current_user)):
    """Returns total tokens consumed and remaining daily query quota."""
    return usage_service.get_user_summary(current_user.id)
