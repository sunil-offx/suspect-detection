from abc import ABC, abstractmethod
from typing import Optional, Dict, Any
from app.schemas.facial_report import FacialReportSchema


class LLMProvider(ABC):
    @abstractmethod
    def analyze(
        self,
        description: str,
        structured_fields: Optional[Dict[str, Any]] = None
    ) -> FacialReportSchema:
        """Analyze textual description and structured fields into structured facial report."""
        pass

    @abstractmethod
    def extract_vision_features(
        self,
        image_bytes: bytes,
        mime: str
    ) -> Dict[str, Any]:
        """Extract observable physical features from an image without demographic speculation."""
        pass

    @abstractmethod
    def refine_features(
        self,
        current_report: Dict[str, Any],
        instruction: str
    ) -> Dict[str, Any]:
        """Compute feature deltas from natural language instruction."""
        pass


class TranscriptionProvider(ABC):
    @abstractmethod
    def transcribe(self, audio_bytes: bytes, mime: str) -> str:
        """Transcribe speech audio into clear text."""
        pass


class ImageProvider(ABC):
    @abstractmethod
    def generate(self, prompt: str) -> bytes:
        """Generate forensic pencil sketch composite as PNG image bytes."""
        pass
