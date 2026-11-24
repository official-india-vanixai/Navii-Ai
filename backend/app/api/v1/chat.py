"""
Chat & AI Intelligence Endpoints.
Connected to OpenRouterService for live multi-model completions and SSE streaming.
Enforces strict free-tier verification and automatic fallback across 5 approved free models.
"""

import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse

from app.core.security import get_current_user
from app.core.rate_limit import rate_limiter
from app.models.schemas import (
    UserProfile,
    ChatCompletionRequest,
    ChatCompletionResponse,
    ChatMessage
)
from app.services.openrouter_service import openrouter_service, FREE_MODELS
from app.services.usage_service import usage_service

router = APIRouter(prefix="/chat", tags=["AI Chat Intelligence"])


@router.post("/completions", response_model=ChatCompletionResponse)
async def create_chat_completion(
    request: ChatCompletionRequest,
    current_user: UserProfile = Depends(get_current_user)
):
    """
    Synchronous AI chat completion using OpenRouter multi-model router.
    Enforces rate limits, daily quotas, and strict free tier validation.
    """
    # 1. Rate Limiting & Daily Quota Check
    rate_limiter.check_rate_limit(current_user.id)

    # 2. Strict Free Tier Validation Guardrail
    target_model = request.model or "smart"
    try:
        openrouter_service._verify_free_tier(target_model)
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve)
        )

    # 3. Token Limit Guardrail
    prompt_chars = sum(len(m.content) for m in request.messages)
    estimated_prompt_tokens = max(1, prompt_chars // 4)
    rate_limiter.validate_prompt_tokens(estimated_prompt_tokens)

    convo_id = request.conversation_id or f"session_{uuid.uuid4().hex[:10]}"

    try:
        # 4. Live OpenRouter Multi-Model Completion
        ai_res = await openrouter_service.generate_chat_completion(
            messages=request.messages,
            model=target_model,
            temperature=request.temperature,
            mode=request.mode
        )

        prompt_tokens = ai_res.get("prompt_tokens", estimated_prompt_tokens)
        completion_tokens = ai_res.get("completion_tokens", 50)
        total_tokens = prompt_tokens + completion_tokens

        # 5. Record Usage
        usage_service.record_usage(
            user_id=current_user.id,
            operation_type="chat",
            model=ai_res.get("model_used", target_model),
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens
        )

        return ChatCompletionResponse(
            id=f"chatcmpl-{uuid.uuid4().hex[:12]}",
            conversation_id=convo_id,
            response_message=ChatMessage(
                role="assistant",
                content=ai_res["content"],
                metadata={
                    "model_used": ai_res.get("model_used"),
                    "fallback_triggered": ai_res.get("fallback_triggered", False)
                }
            ),
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
            model_used=ai_res.get("model_used"),
            fallback_triggered=ai_res.get("fallback_triggered", False)
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(e)
        )


@router.post("/stream")
async def stream_chat_completion(
    request: ChatCompletionRequest,
    current_user: UserProfile = Depends(get_current_user)
):
    """
    Server-Sent Events (SSE) streaming endpoint streaming live OpenRouter chunks
    with automatic 429 failover to secondary free models.
    """
    rate_limiter.check_rate_limit(current_user.id)

    target_model = request.model or "smart"
    try:
        openrouter_service._verify_free_tier(target_model)
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve)
        )

    prompt_chars = sum(len(m.content) for m in request.messages)
    estimated_prompt_tokens = max(1, prompt_chars // 4)
    rate_limiter.validate_prompt_tokens(estimated_prompt_tokens)

    convo_id = request.conversation_id or f"session_{uuid.uuid4().hex[:10]}"

    # Stream chunks from OpenRouterService
    sse_stream = openrouter_service.stream_chat_completion(
        messages=request.messages,
        conversation_id=convo_id,
        model=target_model,
        temperature=request.temperature,
        mode=request.mode
    )

    usage_service.record_usage(
        user_id=current_user.id,
        operation_type="chat_stream",
        model=target_model,
        prompt_tokens=estimated_prompt_tokens,
        completion_tokens=100
    )

    return StreamingResponse(sse_stream, media_type="text/event-stream")
