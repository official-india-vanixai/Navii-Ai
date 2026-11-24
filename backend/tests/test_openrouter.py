"""
Unit Tests for OpenRouter Multi-Model AI Service.
Validates Smart Routing, Multi-AI ensemble, Free Tier Security Enforcer, and Live Availability.
"""

import sys
import os
import asyncio
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.openrouter_service import openrouter_service, FREE_MODELS
from app.models.schemas import ChatMessage


def test_free_tier_security_enforcement():
    # 1. Allowed free models
    for model_id in FREE_MODELS.keys():
        openrouter_service._verify_free_tier(model_id)  # Should not raise

    openrouter_service._verify_free_tier("smart")
    openrouter_service._verify_free_tier("multi")

    # 2. Blocked paid models
    blocked_models = [
        "openai/gpt-4o",
        "anthropic/claude-3-5-sonnet",
        "google/gemini-pro-1.5",
        "meta-llama/llama-3-70b-instruct",
        "mistralai/mixtral-8x7b-instruct"
    ]
    for paid_model in blocked_models:
        with pytest.raises(ValueError) as excinfo:
            openrouter_service._verify_free_tier(paid_model)
        assert "SECURITY VIOLATION" in str(excinfo.value)


def test_smart_routing_logic():
    # Coding -> Google Gemma 4 26B
    code_route = openrouter_service.route_smart_model("def calculate_fibonacci(n):", mode="coding")
    assert code_route == "google/gemma-4-26b-a4b-it:free"

    # Deep Reasoning / Architecture -> NVIDIA Nemotron 3 Ultra 550B
    reasoning_route = openrouter_service.route_smart_model("Analyze the strategic architecture and evaluate tradeoffs")
    assert reasoning_route == "nvidia/nemotron-3-ultra-550b-a55b:free"

    # Files / Document -> NVIDIA Nemotron 3.5 Super VL
    file_route = openrouter_service.route_smart_model("Extract the tables and analyze the pdf document structure", mode="files")
    assert file_route == "nvidia/nemotron-3.5-super-vl:free"

    # Writing / Email -> Baidu ERNIE 5.5 Flash
    writing_route = openrouter_service.route_smart_model("Draft a formal executive briefing email", mode="writing")
    assert writing_route == "baidu/ernie-5.5-flash-preview:free"

    # General / Default -> Google Gemma 4 26B
    general_route = openrouter_service.route_smart_model("What is quantum computing?")
    assert general_route == "google/gemma-4-26b-a4b-it:free"


def test_models_catalog_structure():
    models = asyncio.run(openrouter_service.get_available_models())
    assert len(models) == 5
    for m in models:
        assert m["id"].endswith(":free")
        assert m["free_tier"] is True
        assert "badge" in m
        assert "specialty" in m
        assert "is_online" in m
