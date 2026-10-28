from typing import Union
from app.core.config import settings
from app.providers.base import LLMProvider, TranscriptionProvider, ImageProvider
from app.providers.exceptions import ProviderError, ProviderUnavailable, ProviderResponseError

from app.providers.llm.noop_provider import NoOpLLMProvider
from app.providers.llm.openai_provider import OpenAILLMProvider
from app.providers.llm.anthropic_provider import AnthropicLLMProvider
from app.providers.llm.groq_provider import GroqLLMProvider

from app.providers.transcription.noop_provider import NoOpTranscriptionProvider
from app.providers.transcription.openai_whisper import OpenAIWhisperProvider
from app.providers.transcription.groq_whisper import GroqWhisperProvider
from app.providers.transcription.local_whisper import LocalWhisperProvider

from app.providers.image.noop_provider import NoOpImageProvider
from app.providers.image.replicate_flux import ReplicateFluxProvider
from app.providers.image.fal_provider import FalImageProvider
from app.providers.image.hf_space_provider import HuggingFaceSpaceImageProvider, ZImageTurboProvider
from app.providers.image.pollinations_provider import PollinationsImageProvider
from app.providers.image.resilient_provider import ResilientImageProvider


def get_provider(kind: str) -> Union[LLMProvider, TranscriptionProvider, ImageProvider]:
    k = kind.lower()
    if k == "llm":
        prov = (settings.LLM_PROVIDER or "none").lower()
        api_key = settings.LLM_API_KEY or ""
        if (prov == "groq" or api_key.startswith("gsk_")) and api_key:
            model = settings.LLM_MODEL
            if not model or model in ("gpt-4o-mini", "none"):
                model = "openai/gpt-oss-120b"
            return GroqLLMProvider(api_key=api_key, model=model)
        elif prov == "openai" and api_key:
            return OpenAILLMProvider(api_key=api_key, model=settings.LLM_MODEL)
        elif prov == "anthropic" and api_key:
            return AnthropicLLMProvider(api_key=api_key, model=settings.LLM_MODEL)
        return NoOpLLMProvider(message="LLM_PROVIDER is none or LLM_API_KEY not configured")

    elif k in ("transcription", "whisper"):
        prov = (settings.WHISPER_PROVIDER or "none").lower()
        api_key = settings.WHISPER_API_KEY or settings.LLM_API_KEY or ""
        if (prov == "groq" or (prov == "none" and api_key.startswith("gsk_")) or api_key.startswith("gsk_")) and api_key:
            model = settings.WHISPER_MODEL
            if not model or model in ("whisper-1", "none", "base"):
                model = "whisper-large-v3-turbo"
            return GroqWhisperProvider(api_key=api_key, model=model)
        elif prov == "openai" and api_key:
            return OpenAIWhisperProvider(api_key=api_key, model=settings.WHISPER_MODEL)
        elif prov == "local":
            return LocalWhisperProvider(model_size=settings.WHISPER_MODEL)
        return NoOpTranscriptionProvider(message="WHISPER_PROVIDER is none or WHISPER_API_KEY not configured")

    elif k == "image":
        prov = (settings.IMAGE_PROVIDER or "none").lower()
        pollinations_prov = PollinationsImageProvider()

        if prov in ("pollinations", "flux", "pollination"):
            return ResilientImageProvider([pollinations_prov], name="PollinationsFlux")

        if prov == "replicate" and settings.IMAGE_API_KEY:
            rep = ReplicateFluxProvider(api_key=settings.IMAGE_API_KEY, model=settings.IMAGE_MODEL)
            return ResilientImageProvider([rep, pollinations_prov], name="ReplicateWithFallback")

        elif prov == "fal" and settings.IMAGE_API_KEY:
            fal = FalImageProvider(api_key=settings.IMAGE_API_KEY, model=settings.IMAGE_MODEL)
            return ResilientImageProvider([fal, pollinations_prov], name="FalWithFallback")

        elif prov in ("huggingface", "hf", "huggingface_space", "z-image-turbo", "z_image_turbo", "gradio"):
            model = settings.IMAGE_MODEL
            if not model or model in ("flux-schnell", "none"):
                model = "mrfakename/Z-Image-Turbo"
            hf = HuggingFaceSpaceImageProvider(
                api_key=settings.IMAGE_API_KEY,
                model=model
            )
            # Wrap HF in ResilientImageProvider with Pollinations fallback
            return ResilientImageProvider([hf, pollinations_prov], name="HuggingFaceWithFallback")

        # Default fallback to Pollinations if any image request occurs
        return ResilientImageProvider([pollinations_prov], name="DefaultPollinations")

    raise ValueError(f"Unknown provider kind requested: {kind}")


__all__ = [
    "get_provider",
    "LLMProvider",
    "TranscriptionProvider",
    "ImageProvider",
    "GroqLLMProvider",
    "GroqWhisperProvider",
    "HuggingFaceSpaceImageProvider",
    "ZImageTurboProvider",
    "PollinationsImageProvider",
    "ResilientImageProvider",
    "ProviderError",
    "ProviderUnavailable",
    "ProviderResponseError",
]
