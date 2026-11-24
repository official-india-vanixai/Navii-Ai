"""
OpenAI Integration Service for N.A.V.I.I.
Provides live GPT-4o chat completions, SSE streaming, Whisper transcription, and TTS synthesis.
Keys are kept strictly on the cloud backend and never exposed to the client application.
"""

import io
import json
import base64
import asyncio
from typing import AsyncGenerator, List, Dict, Any, Optional
from openai import AsyncOpenAI, AuthenticationError, RateLimitError, APIConnectionError, APIError

from app.core.config import settings
from app.models.schemas import ChatMessage


SYSTEM_PERSONA = (
    "You are N.A.V.I.I (Neural Assistant for Virtual Intelligence & Interaction), "
    "a professional, futuristic desktop AI assistant. "
    "Tagline: 'Intelligence at Your Fingertips.' "
    "Deliver concise, structured, highly accurate, and intelligent responses. "
    "When providing code, write clean, production-ready, type-annotated code blocks."
)

MODE_INSTRUCTIONS = {
    "chat": "Engage as an intelligent cognitive copilot with clear markdown formatting.",
    "coding": "Focus on high-performance code architecture, async patterns, type safety, and bug explanations.",
    "writing": "Adopt an executive, articulate tone tailored for high-stakes business communication and drafting.",
    "files": "Analyze uploaded documents with precision, highlighting key findings, metrics, and actionable items.",
    "search": "Synthesize web research with factual clarity and structured bullet points."
}


class OpenAIService:
    def __init__(self):
        self._client: Optional[AsyncOpenAI] = None

    @property
    def client(self) -> Optional[AsyncOpenAI]:
        if not self._client and settings.OPENAI_API_KEY:
            self._client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        return self._client

    def is_configured(self) -> bool:
        return bool(settings.OPENAI_API_KEY and len(settings.OPENAI_API_KEY.strip()) > 10)

    def _build_messages_payload(self, messages: List[ChatMessage], mode: str) -> List[Dict[str, str]]:
        system_content = f"{SYSTEM_PERSONA}\n\n[Active Module: {mode.upper()}]\n{MODE_INSTRUCTIONS.get(mode, '')}"
        payload = [{"role": "system", "content": system_content}]

        for msg in messages:
            if msg.role in ["user", "assistant", "system"]:
                payload.append({"role": msg.role, "content": msg.content})

        return payload

    async def generate_chat_completion(
        self,
        messages: List[ChatMessage],
        model: Optional[str] = None,
        temperature: float = 0.7,
        mode: str = "chat"
    ) -> Dict[str, Any]:
        """
        Executes a standard non-streaming chat completion with OpenAI.
        """
        chosen_model = model or settings.OPENAI_DEFAULT_MODEL

        if not self.is_configured():
            return {
                "content": (
                    "⚠️ **OpenAI API Key Not Configured**\n\n"
                    "To activate live AI intelligence, add your OpenAI API key to `backend/.env`:\n"
                    "```env\nOPENAI_API_KEY=sk-proj-your_actual_key_here\n```\n"
                    "All cognitive endpoints are ready and listening."
                ),
                "prompt_tokens": sum(len(m.content) for m in messages) // 4,
                "completion_tokens": 50,
                "model": chosen_model,
                "live_api": False
            }

        try:
            formatted_messages = self._build_messages_payload(messages, mode)
            response = await self.client.chat.completions.create(
                model=chosen_model,
                messages=formatted_messages,
                temperature=temperature
            )

            choice = response.choices[0]
            usage = response.usage

            return {
                "content": choice.message.content or "",
                "prompt_tokens": usage.prompt_tokens if usage else 0,
                "completion_tokens": usage.completion_tokens if usage else 0,
                "model": response.model,
                "live_api": True
            }

        except AuthenticationError:
            raise ValueError("OpenAI Authentication Failed: The API key provided in backend/.env is invalid or revoked.")
        except RateLimitError:
            raise ValueError("OpenAI Rate Limit Exceeded: Check your OpenAI account tier and billing limits.")
        except APIConnectionError:
            raise ValueError("OpenAI Connection Error: Unable to reach OpenAI API gateway.")
        except APIError as e:
            raise ValueError(f"OpenAI API Error: {str(e)}")

    async def stream_chat_completion(
        self,
        messages: List[ChatMessage],
        conversation_id: str,
        model: Optional[str] = None,
        temperature: float = 0.7,
        mode: str = "chat"
    ) -> AsyncGenerator[str, None]:
        """
        Streams real-time response tokens using Server-Sent Events (SSE).
        Yields format: data: {"content": str, "conversation_id": str}\n\n
        Terminates with: data: [DONE]\n\n
        """
        chosen_model = model or settings.OPENAI_DEFAULT_MODEL

        if not self.is_configured():
            warning_msg = (
                "⚠️ **Live OpenAI Integration Ready**\n\n"
                "The backend is fully wired for GPT-4o streaming. "
                "Set your `OPENAI_API_KEY` in `backend/.env` to stream live responses from OpenAI."
            )
            for word in warning_msg.split(" "):
                yield f"data: {json.dumps({'content': word + ' ', 'conversation_id': conversation_id})}\n\n"
                await asyncio.sleep(0.03)
            yield "data: [DONE]\n\n"
            return

        try:
            formatted_messages = self._build_messages_payload(messages, mode)
            stream = await self.client.chat.completions.create(
                model=chosen_model,
                messages=formatted_messages,
                temperature=temperature,
                stream=True
            )

            async for chunk in stream:
                if chunk.choices and len(chunk.choices) > 0:
                    delta = chunk.choices[0].delta
                    if delta and delta.content:
                        payload = {
                            "content": delta.content,
                            "conversation_id": conversation_id,
                            "model": chosen_model
                        }
                        yield f"data: {json.dumps(payload)}\n\n"

            yield "data: [DONE]\n\n"

        except AuthenticationError:
            err_payload = {"error": "AuthenticationError", "content": "\n\n❌ **Error**: Invalid OpenAI API Key."}
            yield f"data: {json.dumps(err_payload)}\n\n"
            yield "data: [DONE]\n\n"
        except RateLimitError:
            err_payload = {"error": "RateLimitError", "content": "\n\n❌ **Error**: OpenAI rate limit reached."}
            yield f"data: {json.dumps(err_payload)}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            err_payload = {"error": "APIError", "content": f"\n\n❌ **Error**: {str(e)}"}
            yield f"data: {json.dumps(err_payload)}\n\n"
            yield "data: [DONE]\n\n"

    async def transcribe_audio(
        self,
        file_bytes: bytes,
        filename: str = "audio.wav",
        language: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Transcribes audio data using OpenAI Whisper API.
        """
        if not self.is_configured():
            return {
                "text": f"[Whisper STT Ready]: Live transcription requires OPENAI_API_KEY in backend/.env. Processed file '{filename}'.",
                "language": language or "en",
                "duration_seconds": 2.5,
                "live_api": False
            }

        try:
            audio_file = io.BytesIO(file_bytes)
            audio_file.name = filename

            kwargs = {
                "model": "whisper-1",
                "file": audio_file
            }
            if language:
                kwargs["language"] = language

            transcript = await self.client.audio.transcriptions.create(**kwargs)

            return {
                "text": transcript.text,
                "language": language or "en",
                "live_api": True
            }
        except Exception as e:
            raise ValueError(f"Whisper Transcription Error: {str(e)}")

    async def synthesize_speech(
        self,
        text: str,
        voice: str = "alloy",
        speed: float = 1.0
    ) -> Dict[str, Any]:
        """
        Generates TTS audio stream from text using OpenAI TTS-1.
        Returns base64 encoded MP3 audio data.
        """
        if not self.is_configured():
            return {
                "audio_base64": None,
                "voice": voice,
                "message": "OpenAI TTS ready. Set OPENAI_API_KEY in backend/.env for high-fidelity neural speech synthesis.",
                "live_api": False
            }

        try:
            response = await self.client.audio.speech.create(
                model="tts-1",
                voice=voice,
                input=text,
                speed=speed
            )

            audio_bytes = response.read()
            encoded = base64.b64encode(audio_bytes).decode("utf-8")

            return {
                "audio_base64": encoded,
                "voice": voice,
                "message": "Speech synthesis complete",
                "live_api": True
            }
        except Exception as e:
            raise ValueError(f"OpenAI TTS Error: {str(e)}")


openai_service = OpenAIService()
