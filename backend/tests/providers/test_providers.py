import os
import glob
from pathlib import Path
import pytest

from app.core.config import settings
from app.providers import get_provider, ProviderUnavailable
from app.providers.llm.noop_provider import NoOpLLMProvider
from app.providers.transcription.noop_provider import NoOpTranscriptionProvider
from app.providers.image.noop_provider import NoOpImageProvider
from app.providers.llm.openai_provider import OpenAILLMProvider
from app.providers.transcription.openai_whisper import OpenAIWhisperProvider
from app.providers.image.replicate_flux import ReplicateFluxProvider
from app.providers.image.hf_space_provider import HuggingFaceSpaceImageProvider


def test_factory_defaults_to_noop_when_keys_missing(monkeypatch):
    monkeypatch.setattr(settings, "LLM_PROVIDER", "none")
    monkeypatch.setattr(settings, "LLM_API_KEY", None)
    monkeypatch.setattr(settings, "WHISPER_PROVIDER", "none")
    monkeypatch.setattr(settings, "WHISPER_API_KEY", None)
    monkeypatch.setattr(settings, "IMAGE_PROVIDER", "none")
    monkeypatch.setattr(settings, "IMAGE_API_KEY", None)

    llm = get_provider("llm")
    whisper = get_provider("transcription")
    image = get_provider("image")

    assert isinstance(llm, NoOpLLMProvider)
    assert isinstance(whisper, NoOpTranscriptionProvider)
    assert isinstance(image, NoOpImageProvider)


def test_noop_providers_raise_provider_unavailable():
    llm = NoOpLLMProvider()
    with pytest.raises(ProviderUnavailable) as exc:
        llm.analyze("suspect has dark hair")
    assert "LLM_PROVIDER" in str(exc.value)

    whisper = NoOpTranscriptionProvider()
    with pytest.raises(ProviderUnavailable) as exc:
        whisper.transcribe(b"fake audio", "audio/mp3")
    assert "WHISPER_PROVIDER" in str(exc.value)

    image = NoOpImageProvider()
    with pytest.raises(ProviderUnavailable) as exc:
        image.generate("forensic pencil sketch")
    assert "IMAGE_PROVIDER" in str(exc.value)


def test_factory_returns_configured_provider_when_key_present(monkeypatch):
    monkeypatch.setattr(settings, "LLM_PROVIDER", "openai")
    monkeypatch.setattr(settings, "LLM_API_KEY", "test-key-mock")
    llm = get_provider("llm")
    assert isinstance(llm, OpenAILLMProvider)

    monkeypatch.setattr(settings, "WHISPER_PROVIDER", "openai")
    monkeypatch.setattr(settings, "WHISPER_API_KEY", "test-key-mock")
    whisper = get_provider("transcription")
    assert isinstance(whisper, OpenAIWhisperProvider)

    monkeypatch.setattr(settings, "IMAGE_PROVIDER", "replicate")
    monkeypatch.setattr(settings, "IMAGE_API_KEY", "test-key-mock")
    image = get_provider("image")
    assert isinstance(image, ReplicateFluxProvider)

    monkeypatch.setattr(settings, "IMAGE_PROVIDER", "huggingface")
    monkeypatch.setattr(settings, "IMAGE_MODEL", "https://huggingface.co/spaces/mrfakename/Z-Image-Turbo")
    hf_image = get_provider("image")
    assert isinstance(hf_image, HuggingFaceSpaceImageProvider)
    assert hf_image.space_id == "mrfakename/Z-Image-Turbo"


def test_hf_space_provider_initialization():
    provider = HuggingFaceSpaceImageProvider(
        model="https://huggingface.co/spaces/mrfakename/Z-Image-Turbo",
        height=768,
        width=768,
        num_inference_steps=8
    )
    assert provider.space_id == "mrfakename/Z-Image-Turbo"
    assert provider.height == 768
    assert provider.width == 768
    assert provider.num_inference_steps == 8


def test_no_provider_imports_fastapi_or_db():
    providers_dir = Path(__file__).resolve().parent.parent.parent / "app" / "providers"
    py_files = list(providers_dir.rglob("*.py"))
    assert len(py_files) > 0, "No provider files found"

    forbidden = ["fastapi", "starlette", "sqlalchemy", "app.database"]
    violations = []
    for f in py_files:
        with open(f, "r", encoding="utf-8") as fh:
            for idx, line in enumerate(fh, start=1):
                stripped = line.strip()
                if stripped.startswith("import ") or stripped.startswith("from "):
                    for forb in forbidden:
                        if forb in stripped:
                            violations.append(f"{f.name}:{idx} -> {stripped}")

    assert not violations, f"Forbidden imports detected in providers:\n" + "\n".join(violations)
