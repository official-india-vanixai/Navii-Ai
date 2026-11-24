"""
Comprehensive Integration Tests for N.A.V.I.I FastAPI Backend.
Tests Auth, Multi-Model Chat, Paid Model Rejection, Streaming, Voice, Files, Search, and Rate Limiting.
"""

import sys
import os
import io
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app

client = TestClient(app)


def test_root_and_health():
    res_root = client.get("/")
    assert res_root.status_code == 200
    assert res_root.json()["status"] == "online"

    res_health = client.get("/health")
    assert res_health.status_code == 200
    assert res_health.json()["status"] == "healthy"


def test_models_discovery_endpoint():
    res = client.get("/api/v1/models")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert data["provider"] == "OpenRouter (Free Tier Only)"
    assert len(data["models"]) == 5
    assert len(data["modes"]) == 2

    # Verify all 5 exact IDs exist in catalog
    model_ids = [m["id"] for m in data["models"]]
    expected_ids = [
        "google/gemma-4-26b-a4b-it:free",
        "nvidia/nemotron-3-ultra-550b-a55b:free",
        "particle-ai/particle-1:free",
        "nvidia/nemotron-3.5-super-vl:free",
        "baidu/ernie-5.5-flash-preview:free"
    ]
    for exp_id in expected_ids:
        assert exp_id in model_ids


def test_auth_and_user_settings():
    res_me = client.get("/api/v1/auth/me")
    assert res_me.status_code == 200
    assert "email" in res_me.json()

    res_settings = client.get("/api/v1/auth/settings")
    assert res_settings.status_code == 200
    assert res_settings.json()["theme"] in ["dark", "light"]

    res_update = client.put("/api/v1/auth/settings", json={"theme": "light", "voice_speed": 1.2})
    assert res_update.status_code == 200
    assert res_update.json()["theme"] == "light"
    assert res_update.json()["voice_speed"] == 1.2


def test_paid_model_rejection_security():
    """
    CRITICAL SECURITY TEST:
    Verify that requesting any paid model (e.g. gpt-4o, claude-3-opus) is immediately
    rejected with HTTP 400 and security violation message.
    """
    payload = {
        "messages": [{"role": "user", "content": "Hello"}],
        "model": "gpt-4o"
    }
    res = client.post("/api/v1/chat/completions", json=payload)
    assert res.status_code == 400
    assert "SECURITY VIOLATION" in res.json()["detail"]


def test_chat_completions_smart_and_free():
    # 1. Smart Mode Auto-Routing
    payload_chat = {
        "messages": [{"role": "user", "content": "What is the mission of N.A.V.I.I?"}],
        "mode": "chat",
        "model": "smart"
    }
    res_chat = client.post("/api/v1/chat/completions", json=payload_chat)
    assert res_chat.status_code == 200
    data = res_chat.json()
    assert data["response_message"]["role"] == "assistant"
    assert len(data["response_message"]["content"]) > 0
    assert data["total_tokens"] > 0
    assert data["model_used"].endswith(":free")

    # 2. Specific Free Model
    payload_gemma = {
        "messages": [{"role": "user", "content": "Write a python function"}],
        "model": "google/gemma-4-26b-a4b-it:free"
    }
    res_gemma = client.post("/api/v1/chat/completions", json=payload_gemma)
    assert res_gemma.status_code == 200
    assert res_gemma.json()["model_used"].endswith(":free")


def test_chat_streaming_sse():
    payload = {
        "messages": [{"role": "user", "content": "Stream this test"}],
        "model": "smart",
        "stream": True
    }
    res = client.post("/api/v1/chat/stream", json=payload)
    assert res.status_code == 200
    assert "text/event-stream" in res.headers["content-type"]
    text = res.text
    assert "data:" in text
    assert "[DONE]" in text


def test_voice_endpoints():
    dummy_wav = io.BytesIO(b"RIFF\x24\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00D\xac\x00\x00")
    files = {"file": ("test_recording.wav", dummy_wav, "audio/wav")}
    res_transcribe = client.post("/api/v1/voice/transcribe", files=files)
    assert res_transcribe.status_code == 200
    assert res_transcribe.json()["status"] == "Transcribed"

    res_synth = client.post("/api/v1/voice/synthesize", json={"text": "Hello Operator", "voice": "alloy", "speed": 1.0})
    assert res_synth.status_code == 200
    assert res_synth.json()["voice"] == "alloy"

    res_invalid = client.post("/api/v1/voice/synthesize", json={"text": "Hello", "voice": "unknown_voice"})
    assert res_invalid.status_code == 400


def test_file_extraction():
    plain_content = b"N.A.V.I.I Architectural Report\nPhase 5: OpenRouter Multi-Model System.\nStatus: Verified."
    test_file = io.BytesIO(plain_content)
    files = {"file": ("architecture_report.txt", test_file, "text/plain")}

    res = client.post("/api/v1/files/extract", files=files)
    assert res.status_code == 200
    data = res.json()
    assert data["filename"] == "architecture_report.txt"
    assert data["file_type"] == "TXT"
    assert "N.A.V.I.I Architectural Report" in data["extracted_text"]
    assert data["word_count"] > 0


def test_web_search():
    payload = {"query": "Electron contextIsolation security", "max_results": 2}
    res = client.post("/api/v1/search/query", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert len(data["results"]) == 2
    assert "summary" in data


def test_usage_monitoring():
    res = client.get("/api/v1/auth/usage")
    assert res.status_code == 200
    data = res.json()
    assert data["total_requests"] >= 0
    assert data["daily_requests_remaining"] <= data["daily_limit"]
