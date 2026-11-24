"""
Voice Processing Endpoints for Speech-to-Text and Text-to-Speech.
Connected to OpenAI Whisper STT and OpenAI Speech TTS.
"""

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status
from app.core.security import get_current_user
from app.core.rate_limit import rate_limiter
from app.models.schemas import (
    UserProfile,
    VoiceTranscriptionResponse,
    VoiceSynthesizeRequest,
    VoiceSynthesizeResponse
)
from app.services.openai_service import openai_service
from app.services.usage_service import usage_service

router = APIRouter(prefix="/voice", tags=["Voice & Audio Processing"])

ALLOWED_AUDIO_FORMATS = ["wav", "mp3", "m4a", "ogg", "webm", "flac"]
VALID_VOICE_PERSONAS = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"]


@router.post("/transcribe", response_model=VoiceTranscriptionResponse)
async def transcribe_audio_file(
    file: UploadFile = File(...),
    current_user: UserProfile = Depends(get_current_user)
):
    """
    Transcribes an uploaded audio file using Whisper STT.
    """
    rate_limiter.check_rate_limit(current_user.id)

    ext = (file.filename or "").split(".")[-1].lower()
    if ext not in ALLOWED_AUDIO_FORMATS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported audio format '.{ext}'. Supported: {', '.join(ALLOWED_AUDIO_FORMATS)}"
        )

    file_bytes = await file.read()

    try:
        res = await openai_service.transcribe_audio(
            file_bytes=file_bytes,
            filename=file.filename or "audio.wav"
        )

        usage_service.record_usage(
            user_id=current_user.id,
            operation_type="voice_stt",
            model="whisper-1",
            prompt_tokens=20,
            completion_tokens=len(res["text"]) // 4
        )

        return VoiceTranscriptionResponse(
            text=res["text"],
            language=res.get("language", "en"),
            duration_seconds=res.get("duration_seconds", 3.0),
            status="Transcribed"
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(e)
        )


@router.post("/synthesize", response_model=VoiceSynthesizeResponse)
async def synthesize_speech(
    request: VoiceSynthesizeRequest,
    current_user: UserProfile = Depends(get_current_user)
):
    """
    Synthesizes speech audio from text using OpenAI TTS.
    """
    rate_limiter.check_rate_limit(current_user.id)

    voice = request.voice.lower()
    if voice not in VALID_VOICE_PERSONAS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid voice persona '{request.voice}'. Valid choices: {', '.join(VALID_VOICE_PERSONAS)}"
        )

    char_count = len(request.text)

    try:
        res = await openai_service.synthesize_speech(
            text=request.text,
            voice=voice,
            speed=request.speed
        )

        usage_service.record_usage(
            user_id=current_user.id,
            operation_type="voice_tts",
            model="tts-1",
            prompt_tokens=char_count // 4,
            completion_tokens=0
        )

        return VoiceSynthesizeResponse(
            audio_format="mp3",
            voice=voice,
            audio_base64=res.get("audio_base64"),
            message=res.get("message", "Speech synthesis complete")
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(e)
        )
