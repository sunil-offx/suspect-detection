from app.providers.base import TranscriptionProvider
from app.providers.exceptions import ProviderUnavailable


class LocalWhisperProvider(TranscriptionProvider):
    def __init__(self, model_size: str = "base"):
        self.model_size = model_size

    def transcribe(self, audio_bytes: bytes, mime: str) -> str:
        # Local whisper requires faster-whisper or openai-whisper binary
        try:
            import whisper  # type: ignore
            # Local execution if installed
            raise ProviderUnavailable("Local whisper model files not downloaded")
        except ImportError:
            raise ProviderUnavailable("Local whisper package not installed in environment")
