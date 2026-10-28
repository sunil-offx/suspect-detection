from typing import Union
from app.core.config import settings
from app.providers.base import LLMProvider, TranscriptionProvider, ImageProvider
from app.providers.exceptions import ProviderError, ProviderUnavailable, ProviderResponseError

from app.providers.llm.noop_provider import NoOpLLMProvider
from app.providers.llm.openai_provider import OpenAILLMProvider
from app.providers.llm.anthropic_provider import AnthropicLLMProvider

from app.providers.transcription.noop_provider import NoOpTranscriptionProvider
from app.providers.transcription.openai_whisper import OpenAIWhisperProvider
from app.providers.transcription.local_whisper import LocalWhisperProvider

from app.providers.image.noop_provider import NoOpImageProvider
from app.providers.image.replicate_flux import ReplicateFluxProvider
from app.providers.image.fal_provider import FalImageProvider


def get_provider(kind: str) -> Union[LLMProvider, TranscriptionProvider, ImageProvider]:
    k = kind.lower()
    if k == "llm":
        prov = (settings.LLM_PROVIDER or "none").lower()
        if prov == "openai" and settings.LLM_API_KEY:
            return OpenAILLMProvider(api_key=settings.LLM_API_KEY, model=settings.LLM_MODEL)
        elif prov == "anthropic" and settings.LLM_API_KEY:
            return AnthropicLLMProvider(api_key=settings.LLM_API_KEY, model=settings.LLM_MODEL)
        return NoOpLLMProvider(message="LLM_PROVIDER is none or LLM_API_KEY not configured")

    elif k in ("transcription", "whisper"):
        prov = (settings.WHISPER_PROVIDER or "none").lower()
        if prov == "openai" and settings.WHISPER_API_KEY:
            return OpenAIWhisperProvider(api_key=settings.WHISPER_API_KEY, model=settings.WHISPER_MODEL)
        elif prov == "local":
            return LocalWhisperProvider(model_size=settings.WHISPER_MODEL)
        return NoOpTranscriptionProvider(message="WHISPER_PROVIDER is none or WHISPER_API_KEY not configured")

    elif k == "image":
        prov = (settings.IMAGE_PROVIDER or "none").lower()
        if prov == "replicate" and settings.IMAGE_API_KEY:
            return ReplicateFluxProvider(api_key=settings.IMAGE_API_KEY, model=settings.IMAGE_MODEL)
        elif prov == "fal" and settings.IMAGE_API_KEY:
            return FalImageProvider(api_key=settings.IMAGE_API_KEY, model=settings.IMAGE_MODEL)
        return NoOpImageProvider(message="IMAGE_PROVIDER is none or IMAGE_API_KEY not configured")

    raise ValueError(f"Unknown provider kind requested: {kind}")


__all__ = [
    "get_provider",
    "LLMProvider",
    "TranscriptionProvider",
    "ImageProvider",
    "ProviderError",
    "ProviderUnavailable",
    "ProviderResponseError",
]
