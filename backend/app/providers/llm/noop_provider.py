from typing import Optional, Dict, Any
from app.providers.base import LLMProvider
from app.providers.exceptions import ProviderUnavailable
from app.schemas.facial_report import FacialReportSchema


class NoOpLLMProvider(LLMProvider):
    def __init__(self, message: str = "LLM_PROVIDER not configured or LLM_API_KEY not set"):
        self.message = message

    def analyze(
        self,
        description: str,
        structured_fields: Optional[Dict[str, Any]] = None
    ) -> FacialReportSchema:
        raise ProviderUnavailable(self.message)

    def extract_vision_features(
        self,
        image_bytes: bytes,
        mime: str
    ) -> Dict[str, Any]:
        raise ProviderUnavailable(self.message)

    def refine_features(
        self,
        current_report: Dict[str, Any],
        instruction: str
    ) -> Dict[str, Any]:
        raise ProviderUnavailable(self.message)
