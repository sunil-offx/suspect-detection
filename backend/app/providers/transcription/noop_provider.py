from app.providers.base import TranscriptionProvider
from app.providers.exceptions import ProviderUnavailable


class NoOpTranscriptionProvider(TranscriptionProvider):
    def __init__(self, message: str = "WHISPER_PROVIDER not configured or WHISPER_API_KEY not set"):
        self.message = message

    def transcribe(self, audio_bytes: bytes, mime: str) -> str:
        raise ProviderUnavailable(self.message)
