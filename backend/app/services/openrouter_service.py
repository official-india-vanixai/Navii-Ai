"""
OpenRouter Multi-Model AI Service for N.A.V.I.I.
Integrates five FREE models exclusively with Smart Routing, Multi-AI Mode, and Auto-Failover.

FREE MODELS:
1. nvidia/nemotron-3-ultra-550b-a55b:free
2. baidu/ernie-5.5-flash-preview:free
3. nvidia/nemotron-3.5-super-vl:free
4. particle-ai/particle-1:free
5. google/gemma-4-26b-a4b-it:free
"""

import json
import time
import httpx
import asyncio
from typing import List, Dict, Any, Optional, AsyncGenerator

from app.core.config import settings
from app.models.schemas import ChatMessage

# ==============================================================================
# 1. APPROVED FREE MODELS REGISTRY
# ==============================================================================
FREE_MODELS: Dict[str, Dict[str, Any]] = {
    "google/gemma-4-26b-a4b-it:free": {
        "id": "google/gemma-4-26b-a4b-it:free",
        "name": "Google Gemma 4 26B A4B IT",
        "badge": "Gemma 4 26B (Free)",
        "provider": "Google",
        "context_length": 8192,
        "specialty": "Coding, Logic & Technical Reasoning",
        "free_tier": True
    },
    "nvidia/nemotron-3-ultra-550b-a55b:free": {
        "id": "nvidia/nemotron-3-ultra-550b-a55b:free",
        "name": "NVIDIA Nemotron 3 Ultra 550B",
        "badge": "Nemotron 3 Ultra (Free)",
        "provider": "NVIDIA",
        "context_length": 4096,
        "specialty": "Deep Reasoning & Architecture",
        "free_tier": True
    },
    "particle-ai/particle-1:free": {
        "id": "particle-ai/particle-1:free",
        "name": "Particle AI Particle-1",
        "badge": "Particle-1 (Free)",
        "provider": "Particle AI",
        "context_length": 8192,
        "specialty": "Concise General Intelligence & QA",
        "free_tier": True
    },
    "nvidia/nemotron-3.5-super-vl:free": {
        "id": "nvidia/nemotron-3.5-super-vl:free",
        "name": "NVIDIA Nemotron 3.5 Super VL",
        "badge": "Nemotron 3.5 VL (Free)",
        "provider": "NVIDIA",
        "context_length": 4096,
        "specialty": "Visual Reasoning & Document Structure",
        "free_tier": True
    },
    "baidu/ernie-5.5-flash-preview:free": {
        "id": "baidu/ernie-5.5-flash-preview:free",
        "name": "Baidu ERNIE 5.5 Flash Preview",
        "badge": "ERNIE 5.5 Flash (Free)",
        "provider": "Baidu",
        "context_length": 8192,
        "specialty": "Fast Drafting & Executive Briefings",
        "free_tier": True
    }
}

FALLBACK_ORDER: List[str] = [
    "google/gemma-4-26b-a4b-it:free",
    "nvidia/nemotron-3-ultra-550b-a55b:free",
    "particle-ai/particle-1:free",
    "nvidia/nemotron-3.5-super-vl:free",
    "baidu/ernie-5.5-flash-preview:free"
]

SYSTEM_PERSONA = (
    "You are N.A.V.I.I (Neural Assistant for Virtual Intelligence & Interaction), "
    "a professional desktop AI assistant. Tagline: 'Intelligence at Your Fingertips.' "
    "Provide clear, direct, and structured responses using markdown."
)


class OpenRouterService:
    def __init__(self):
        self.base_url = settings.OPENROUTER_BASE_URL.rstrip("/")
        self.cached_models: Dict[str, Any] = {}
        self.cached_models_time: float = 0
        self.error_tracker: Dict[str, int] = {m: 0 for m in FREE_MODELS}

    def _get_api_key_for_model(self, model_id: str) -> str:
        """
        Retrieves the appropriate OpenRouter API key.
        Uses model-specific key if set, falling back to primary OPENROUTER_API_KEY.
        """
        mapping = {
            "nvidia/nemotron-3-ultra-550b-a55b:free": settings.OPENROUTER_KEY_NEMOTRON_ULTRA,
            "baidu/ernie-5.5-flash-preview:free": settings.OPENROUTER_KEY_ERNIE,
            "nvidia/nemotron-3.5-super-vl:free": settings.OPENROUTER_KEY_NEMOTRON_VL,
            "particle-ai/particle-1:free": settings.OPENROUTER_KEY_PARTICLE,
            "google/gemma-4-26b-a4b-it:free": settings.OPENROUTER_KEY_GEMMA,
        }
        key = mapping.get(model_id)
        if key and key.startswith("sk-or-v1-"):
            return key
        return settings.OPENROUTER_API_KEY

    def _verify_free_tier(self, model_id: str):
        """
        STRICT SECURITY GUARD:
        Never allow paid model IDs. Any ID without ':free' is instantly rejected.
        """
        if not model_id.endswith(":free") and model_id not in ["smart", "multi"]:
            raise ValueError(
                f"SECURITY VIOLATION: Model '{model_id}' is not in the approved free tier. "
                "N.A.V.I.I only executes verified free-tier models."
            )

    def route_smart_model(self, prompt: str, mode: str = "chat") -> str:
        """
        Smart Mode Algorithm:
        Routes queries to the optimal free model based on task classification.
        """
        prompt_lower = prompt.lower()

        # 1. Coding Tasks
        code_keywords = ["def ", "class ", "import ", "const ", "function", "bug", "async", "python", "javascript", "sql"]
        if mode == "coding" or any(k in prompt_lower for k in code_keywords):
            return "google/gemma-4-26b-a4b-it:free"

        # 2. Vision / Document / Architecture Analysis
        if mode == "files" or any(k in prompt_lower for k in ["pdf", "diagram", "document", "extract", "table"]):
            return "nvidia/nemotron-3.5-super-vl:free"

        # 3. High-Order Reasoning
        if any(k in prompt_lower for k in ["analyze", "compare", "evaluate", "why", "strategy", "architecture"]):
            return "nvidia/nemotron-3-ultra-550b-a55b:free"

        # 4. Rapid Writing / Drafting
        if mode == "writing" or any(k in prompt_lower for k in ["draft", "email", "letter", "summarize", "rewrite"]):
            return "baidu/ernie-5.5-flash-preview:free"

        # Default versatile model
        return "google/gemma-4-26b-a4b-it:free"

    async def get_available_models(self) -> List[Dict[str, Any]]:
        """
        Verifies live availability of the 5 free models against OpenRouter API.
        Caches results for 3 minutes.
        """
        now = time.time()
        if self.cached_models and (now - self.cached_models_time) < 180:
            return list(self.cached_models.values())

        headers = {
            "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
            "HTTP-Referer": "https://navii.ai",
            "X-Title": "N.A.V.I.I"
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get(f"{self.base_url}/models", headers=headers)
                if res.status_code == 200:
                    api_models = {m["id"]: m for m in res.json().get("data", [])}
                    result = []
                    for model_id, meta in FREE_MODELS.items():
                        is_online = model_id in api_models
                        result.append({
                            **meta,
                            "is_online": is_online,
                            "error_count": self.error_tracker.get(model_id, 0)
                        })
                    self.cached_models = {m["id"]: m for m in result}
                    self.cached_models_time = now
                    return result
        except Exception as e:
            print(f"[N.A.V.I.I OpenRouter] Model verification warning: {e}")

        # Fallback to local registry
        return [
            {**meta, "is_online": True, "error_count": self.error_tracker.get(m_id, 0)}
            for m_id, meta in FREE_MODELS.items()
        ]

    async def generate_chat_completion(
        self,
        messages: List[ChatMessage],
        model: str = "smart",
        temperature: float = 0.7,
        mode: str = "chat"
    ) -> Dict[str, Any]:
        """
        Executes chat completion with automatic model fallback across free models.
        """
        # Determine initial target model
        last_prompt = next((m.content for m in reversed(messages) if m.role == "user"), "")
        if model == "smart" or not model:
            target_model = self.route_smart_model(last_prompt, mode)
        elif model == "multi":
            return await self.execute_multi_ai(messages, mode)
        else:
            target_model = model

        self._verify_free_tier(target_model)

        # Build fallback list starting with target_model
        fallback_queue = [target_model] + [m for m in FALLBACK_ORDER if m != target_model]

        formatted_messages = [{"role": "system", "content": SYSTEM_PERSONA}]
        for m in messages:
            formatted_messages.append({"role": m.role, "content": m.content})

        last_error = None
        for candidate_model in fallback_queue:
            self._verify_free_tier(candidate_model)
            api_key = self._get_api_key_for_model(candidate_model)

            headers = {
                "Authorization": f"Bearer {api_key}",
                "HTTP-Referer": "https://navii.ai",
                "X-Title": "N.A.V.I.I",
                "Content-Type": "application/json"
            }
            payload = {
                "model": candidate_model,
                "messages": formatted_messages,
                "temperature": temperature
            }

            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    res = await client.post(
                        f"{self.base_url}/chat/completions",
                        headers=headers,
                        json=payload
                    )

                    if res.status_code == 200:
                        data = res.json()
                        content = data["choices"][0]["message"]["content"]
                        fallback_note = ""
                        if candidate_model != target_model:
                            badge_target = FREE_MODELS.get(target_model, {}).get("badge", target_model)
                            badge_used = FREE_MODELS.get(candidate_model, {}).get("badge", candidate_model)
                            fallback_note = f"\n\n> *[Routed to {badge_used} after {badge_target} encountered rate limits]*"

                        return {
                            "content": content + fallback_note,
                            "model_used": candidate_model,
                            "model_requested": model,
                            "fallback_triggered": candidate_model != target_model,
                            "prompt_tokens": data.get("usage", {}).get("prompt_tokens", len(last_prompt) // 4),
                            "completion_tokens": data.get("usage", {}).get("completion_tokens", len(content) // 4),
                            "live_api": True
                        }
                    elif res.status_code == 429:
                        print(f"[N.A.V.I.I OpenRouter] Model {candidate_model} rate limited (429). Attempting fallback...")
                        self.error_tracker[candidate_model] = self.error_tracker.get(candidate_model, 0) + 1
                        last_error = f"Rate limited on {candidate_model}"
                        continue
                    else:
                        print(f"[N.A.V.I.I OpenRouter] Model {candidate_model} error {res.status_code}: {res.text[:100]}")
                        self.error_tracker[candidate_model] = self.error_tracker.get(candidate_model, 0) + 1
                        last_error = f"Error {res.status_code} on {candidate_model}"
                        continue
            except Exception as e:
                print(f"[N.A.V.I.I OpenRouter] Exception on {candidate_model}: {e}")
                self.error_tracker[candidate_model] = self.error_tracker.get(candidate_model, 0) + 1
                last_error = str(e)
                continue

        raise ValueError(f"All free model endpoints are currently experiencing high traffic ({last_error}). Please try again shortly.")

    async def execute_multi_ai(self, messages: List[ChatMessage], mode: str) -> Dict[str, Any]:
        """
        Multi-AI Mode:
        Executes parallel inference across 2 top free models (Gemma 4 and Nemotron)
        and compiles their outputs into a multi-perspective synthesis.
        """
        models_to_query = ["google/gemma-4-26b-a4b-it:free", "nvidia/nemotron-3-ultra-550b-a55b:free"]

        tasks = [
            self.generate_chat_completion(messages, model=m, mode=mode)
            for m in models_to_query
        ]

        results = await asyncio.gather(*tasks, return_exceptions=True)

        combined_text = "### 🌐 Multi-AI Mode Synthesis\n\n"
        for model_id, res in zip(models_to_query, results):
            badge = FREE_MODELS.get(model_id, {}).get("badge", model_id)
            if isinstance(res, dict) and "content" in res:
                combined_text += f"#### Perspective: {badge}\n{res['content']}\n\n---\n\n"
            else:
                combined_text += f"#### Perspective: {badge}\n*[Temporarily rate limited]*\n\n---\n\n"

        return {
            "content": combined_text,
            "model_used": "multi-ai-ensemble:free",
            "model_requested": "multi",
            "fallback_triggered": False,
            "prompt_tokens": 50,
            "completion_tokens": 150,
            "live_api": True
        }

    async def stream_chat_completion(
        self,
        messages: List[ChatMessage],
        conversation_id: str,
        model: str = "smart",
        temperature: float = 0.7,
        mode: str = "chat"
    ) -> AsyncGenerator[str, None]:
        """
        Streams real-time Server-Sent Events (SSE) from OpenRouter with live fallback.
        """
        last_prompt = next((m.content for m in reversed(messages) if m.role == "user"), "")
        if model == "smart" or not model:
            target_model = self.route_smart_model(last_prompt, mode)
        elif model == "multi":
            # For Multi-AI in stream, run the multi-ai consensus and stream words
            res = await self.execute_multi_ai(messages, mode)
            for word in res["content"].split(" "):
                yield f"data: {json.dumps({'content': word + ' ', 'conversation_id': conversation_id, 'model': 'multi-ai:free'})}\n\n"
                await asyncio.sleep(0.02)
            yield "data: [DONE]\n\n"
            return
        else:
            target_model = model

        self._verify_free_tier(target_model)

        fallback_queue = [target_model] + [m for m in FALLBACK_ORDER if m != target_model]

        formatted_messages = [{"role": "system", "content": SYSTEM_PERSONA}]
        for m in messages:
            formatted_messages.append({"role": m.role, "content": m.content})

        succeeded = False
        for candidate_model in fallback_queue:
            self._verify_free_tier(candidate_model)
            api_key = self._get_api_key_for_model(candidate_model)
            headers = {
                "Authorization": f"Bearer {api_key}",
                "HTTP-Referer": "https://navii.ai",
                "X-Title": "N.A.V.I.I",
                "Content-Type": "application/json"
            }
            payload = {
                "model": candidate_model,
                "messages": formatted_messages,
                "temperature": temperature,
                "stream": True
            }

            try:
                async with httpx.AsyncClient(timeout=45.0) as client:
                    async with client.stream("POST", f"{self.base_url}/chat/completions", headers=headers, json=payload) as resp:
                        if resp.status_code == 200:
                            succeeded = True
                            if candidate_model != target_model:
                                badge_used = FREE_MODELS.get(candidate_model, {}).get("badge", candidate_model)
                                fallback_text = f"> *[Routed to {badge_used} after rate limit]*\n\n"
                                yield f"data: {json.dumps({'content': fallback_text, 'conversation_id': conversation_id, 'model': candidate_model})}\n\n"

                            async for line in resp.aiter_lines():
                                if line.startswith("data: "):
                                    data_body = line[6:].strip()
                                    if data_body == "[DONE]":
                                        break
                                    try:
                                        chunk = json.loads(data_body)
                                        choices = chunk.get("choices", [])
                                        if choices and "delta" in choices[0]:
                                            delta = choices[0]["delta"].get("content", "")
                                            if delta:
                                                yield f"data: {json.dumps({'content': delta, 'conversation_id': conversation_id, 'model': candidate_model})}\n\n"
                                    except Exception:
                                        pass
                            yield "data: [DONE]\n\n"
                            return
                        elif resp.status_code == 429:
                            print(f"[N.A.V.I.I OpenRouter] Stream rate limit on {candidate_model}. Trying fallback...")
                            continue
            except Exception as e:
                print(f"[N.A.V.I.I OpenRouter] Stream exception on {candidate_model}: {e}")
                continue

        if not succeeded:
            err_payload = {
                "error": "RateLimitAll",
                "content": "\n\n⚠️ **All free OpenRouter endpoints are experiencing temporary load.** Please retry in 10 seconds."
            }
            yield f"data: {json.dumps(err_payload)}\n\n"
            yield "data: [DONE]\n\n"


openrouter_service = OpenRouterService()
