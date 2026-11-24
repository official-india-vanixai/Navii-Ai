"""
Unit & Integration Tests for OpenAIService (Phase 5).
Validates prompt formatting, streaming generation, error resilience, and persona configurations.
"""

import sys
import os
import asyncio
from unittest.mock import AsyncMock, patch, MagicMock

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.openai_service import OpenAIService
from app.models.schemas import ChatMessage


def test_openai_payload_builder():
    service = OpenAIService()
    messages = [
        ChatMessage(role="user", content="Build an async client"),
        ChatMessage(role="assistant", content="Here is the client")
    ]

    payload = service._build_messages_payload(messages, mode="coding")
    assert len(payload) == 3
    assert payload[0]["role"] == "system"
    assert "CODING" in payload[0]["content"]
    assert "N.A.V.I.I" in payload[0]["content"]
    assert payload[1]["role"] == "user"
    assert payload[2]["role"] == "assistant"


def test_openai_unconfigured_completion_fallback():
    async def _run():
        service = OpenAIService()
        with patch.object(service, "is_configured", return_value=False):
            res = await service.generate_chat_completion(
                messages=[ChatMessage(role="user", content="Hello Navii")],
                mode="chat"
            )
            assert res["live_api"] is False
            assert "OpenAI API Key Not Configured" in res["content"]

    asyncio.run(_run())


def test_openai_unconfigured_stream_fallback():
    async def _run():
        service = OpenAIService()
        with patch.object(service, "is_configured", return_value=False):
            chunks = []
            async for chunk in service.stream_chat_completion(
                messages=[ChatMessage(role="user", content="Test stream")],
                conversation_id="session_test_1"
            ):
                chunks.append(chunk)

            assert len(chunks) > 0
            assert any("data: [DONE]" in c for c in chunks)
            assert any("data: {" in c for c in chunks)

    asyncio.run(_run())


def test_openai_unconfigured_voice_fallback():
    async def _run():
        service = OpenAIService()
        with patch.object(service, "is_configured", return_value=False):
            # Transcribe
            res_trans = await service.transcribe_audio(b"dummy_bytes", filename="test.wav")
            assert res_trans["live_api"] is False
            assert "Whisper STT Ready" in res_trans["text"]

            # Synthesize
            res_synth = await service.synthesize_speech("Hello", voice="alloy", speed=1.0)
            assert res_synth["live_api"] is False
            assert "OpenAI TTS ready" in res_synth["message"]

    asyncio.run(_run())


def test_openai_live_completion_mocked():
    async def _run():
        service = OpenAIService()
        mock_choice = MagicMock()
        mock_choice.message.content = "Cognitive response from GPT-4o."
        mock_response = MagicMock()
        mock_response.choices = [mock_choice]
        mock_response.usage.prompt_tokens = 25
        mock_response.usage.completion_tokens = 15
        mock_response.model = "gpt-4o"

        mock_client = MagicMock()
        mock_client.chat.completions.create = AsyncMock(return_value=mock_response)

        with patch.object(service, "is_configured", return_value=True), \
             patch.object(service, "_client", mock_client):
            res = await service.generate_chat_completion(
                messages=[ChatMessage(role="user", content="Explain quantum computing")],
                model="gpt-4o",
                mode="chat"
            )
            assert res["live_api"] is True
            assert res["content"] == "Cognitive response from GPT-4o."
            assert res["prompt_tokens"] == 25
            assert res["completion_tokens"] == 15

    asyncio.run(_run())
