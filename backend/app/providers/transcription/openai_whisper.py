import io
import httpx
from app.providers.base import TranscriptionProvider
from app.providers.exceptions import ProviderUnavailable, ProviderResponseError


class OpenAIWhisperProvider(TranscriptionProvider):
    def __init__(self, api_key: str, model: str = "whisper-1"):
        if not api_key:
            raise ProviderUnavailable("OpenAI Whisper API key is missing")
        self.api_key = api_key
        self.model = model
        self.base_url = "https://api.openai.com/v1"

    def transcribe(self, audio_bytes: bytes, mime: str) -> str:
        headers = {"Authorization": f"Bearer {self.api_key}"}
        # Determine extension from mime
        ext = "mp3"
        if "wav" in mime:
            ext = "wav"
        elif "webm" in mime:
            ext = "webm"
        elif "m4a" in mime:
            ext = "m4a"

        files = {
            "file": (f"audio.{ext}", io.BytesIO(audio_bytes), mime),
            "model": (None, self.model),
            "response_format": (None, "json")
        }

        try:
            with httpx.Client(timeout=60.0) as client:
                res = client.post(f"{self.base_url}/audio/transcriptions", headers=headers, files=files)
                if res.status_code != 200:
                    raise ProviderResponseError(f"Whisper transcription error ({res.status_code}): {res.text}")
                data = res.json()
                return data.get("text", "").strip()
        except Exception as e:
            if isinstance(e, (ProviderUnavailable, ProviderResponseError)):
                raise
            raise ProviderResponseError(f"Whisper request failed: {str(e)}")
