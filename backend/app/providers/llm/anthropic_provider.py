import json
from typing import Optional, Dict, Any
import httpx

from app.providers.base import LLMProvider
from app.providers.exceptions import ProviderUnavailable, ProviderResponseError
from app.schemas.facial_report import FacialReportSchema
from app.providers.llm.openai_provider import ANALYSIS_SYSTEM_PROMPT


class AnthropicLLMProvider(LLMProvider):
    def __init__(self, api_key: str, model: str = "claude-3-5-sonnet-20241022"):
        if not api_key:
            raise ProviderUnavailable("Anthropic API key is missing")
        self.api_key = api_key
        self.model = model
        self.base_url = "https://api.anthropic.com/v1"

    def analyze(
        self,
        description: str,
        structured_fields: Optional[Dict[str, Any]] = None
    ) -> FacialReportSchema:
        user_content = f"Witness Statement:\n\"\"\"{description}\"\"\"\n\n"
        if structured_fields:
            user_content += f"Structured Fields:\n{json.dumps(structured_fields)}\n\n"
        user_content += "Respond with raw JSON conforming to FacialReportSchema only."

        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
        }
        payload = {
            "model": self.model,
            "system": ANALYSIS_SYSTEM_PROMPT,
            "messages": [{"role": "user", "content": user_content}],
            "max_tokens": 1500,
            "temperature": 0.1
        }

        try:
            with httpx.Client(timeout=45.0) as client:
                res = client.post(f"{self.base_url}/messages", headers=headers, json=payload)
                if res.status_code != 200:
                    raise ProviderResponseError(f"Anthropic error ({res.status_code}): {res.text}")
                data = res.json()
                text = data["content"][0]["text"]
                # Strip markdown json blocks if present
                clean = text.strip()
                if clean.startswith("```json"):
                    clean = clean[7:]
                if clean.startswith("```"):
                    clean = clean[3:]
                if clean.endswith("```"):
                    clean = clean[:-3]
                parsed = json.loads(clean.strip())
                return FacialReportSchema.model_validate(parsed)
        except Exception as e:
            if isinstance(e, (ProviderUnavailable, ProviderResponseError)):
                raise
            raise ProviderResponseError(f"Anthropic request failed: {str(e)}")

    def extract_vision_features(self, image_bytes: bytes, mime: str) -> Dict[str, Any]:
        raise NotImplementedError("Anthropic vision integration optional")

    def refine_features(self, current_report: Dict[str, Any], instruction: str) -> Dict[str, Any]:
        raise NotImplementedError("Anthropic refinement integration optional")
