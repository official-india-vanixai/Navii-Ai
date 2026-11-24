"""
Pydantic Schemas for API requests, responses, and data contracts.
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime


# -----------------------------------------------------------------------------
# Base & Health Schemas
# -----------------------------------------------------------------------------
class HealthResponse(BaseModel):
    status: str = "healthy"
    version: str = "1.0.0"
    service: str = "N.A.V.I.I Backend"
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    environment: str


# -----------------------------------------------------------------------------
# Chat & AI Schemas
# -----------------------------------------------------------------------------
class ChatMessage(BaseModel):
    role: str = Field(..., description="user, assistant, or system")
    content: str = Field(..., description="The message content")
    metadata: Optional[Dict[str, Any]] = None


class ChatCompletionRequest(BaseModel):
    conversation_id: Optional[str] = None
    messages: List[ChatMessage]
    mode: str = Field(default="chat", description="chat, voice, writing, coding, files, search")
    model: Optional[str] = "smart"
    stream: bool = False
    temperature: float = 0.7


class ChatCompletionResponse(BaseModel):
    model_config = {"protected_namespaces": ()}

    id: str
    conversation_id: str
    response_message: ChatMessage
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    model_used: Optional[str] = None
    fallback_triggered: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)


# -----------------------------------------------------------------------------
# User Profile & Settings Schemas
# -----------------------------------------------------------------------------
class UserProfile(BaseModel):
    id: str
    email: str
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class UserSettings(BaseModel):
    user_id: str
    theme: str = "dark"
    ai_model: str = "smart"
    voice_name: str = "alloy"
    voice_speed: float = 1.0
    auto_tts: bool = False
    sound_effects: bool = True


class UserSettingsUpdate(BaseModel):
    theme: Optional[str] = None
    ai_model: Optional[str] = None
    voice_name: Optional[str] = None
    voice_speed: Optional[float] = None
    auto_tts: Optional[bool] = None
    sound_effects: Optional[bool] = None


class UsageSummaryResponse(BaseModel):
    user_id: str
    total_requests: int = 0
    total_prompt_tokens: int = 0
    total_completion_tokens: int = 0
    total_tokens: int = 0
    daily_requests_remaining: int = 200
    daily_limit: int = 200
    max_prompt_tokens: int = 16384


# -----------------------------------------------------------------------------
# Voice Schemas
# -----------------------------------------------------------------------------
class VoiceTranscriptionResponse(BaseModel):
    text: str
    language: str = "en"
    duration_seconds: float = 0.0
    status: str = "Transcribed"


class VoiceSynthesizeRequest(BaseModel):
    text: str
    voice: str = "alloy"
    speed: float = 1.0


class VoiceSynthesizeResponse(BaseModel):
    audio_format: str = "mp3"
    voice: str = "alloy"
    audio_base64: Optional[str] = None
    message: str = "Speech synthesis complete"


# -----------------------------------------------------------------------------
# File Processing Schemas
# -----------------------------------------------------------------------------
class FileExtractResponse(BaseModel):
    filename: str
    file_type: str
    size_bytes: int
    char_count: int
    word_count: int
    extracted_text: str
    summary_preview: str = ""
    status: str = "Extracted"


# -----------------------------------------------------------------------------
# Search Schemas
# -----------------------------------------------------------------------------
class SearchResultItem(BaseModel):
    title: str
    url: str
    domain: str
    snippet: str


class SearchQueryRequest(BaseModel):
    query: str
    max_results: int = 5


class SearchQueryResponse(BaseModel):
    query: str
    results: List[SearchResultItem]
    summary: str


class SearchResponse(BaseModel):
    query: str
    total_results: int
    results: List[SearchResultItem]
    summary: str
