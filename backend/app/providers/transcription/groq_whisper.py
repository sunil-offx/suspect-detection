import io
import httpx
from app.providers.base import TranscriptionProvider
from app.providers.exceptions import ProviderUnavailable, ProviderResponseError


class GroqWhisperProvider(TranscriptionProvider):
    def __init__(self, api_key: str, model: str = "whisper-large-v3-turbo"):
        if not api_key:
            raise ProviderUnavailable("Groq API key is missing for Whisper transcription")
        self.api_key = api_key
        self.model = model or "whisper-large-v3-turbo"
        self.base_url = "https://api.groq.com/openai/v1"

    def transcribe(self, audio_bytes: bytes, mime: str) -> str:
        headers = {"Authorization": f"Bearer {self.api_key}"}

        # Determine safe file extension from mime
        ext = "mp3"
        mime_lower = (mime or "").lower()
        if "wav" in mime_lower:
            ext = "wav"
        elif "webm" in mime_lower:
            ext = "webm"
        elif "m4a" in mime_lower:
            ext = "m4a"
        elif "ogg" in mime_lower:
            ext = "ogg"
        elif "flac" in mime_lower:
            ext = "flac"

        files = {
            "file": (f"audio.{ext}", io.BytesIO(audio_bytes), mime or "audio/mpeg"),
            "model": (None, self.model),
            "response_format": (None, "json")
        }

        try:
            with httpx.Client(timeout=60.0) as client:
                res = client.post(f"{self.base_url}/audio/transcriptions", headers=headers, files=files)
                if res.status_code != 200:
                    raise ProviderResponseError(f"Groq Whisper transcription error ({res.status_code}): {res.text}")
                data = res.json()
                return data.get("text", "").strip()
        except Exception as e:
            if isinstance(e, (ProviderUnavailable, ProviderResponseError)):
                raise
            raise ProviderResponseError(f"Groq Whisper request failed: {str(e)}")

