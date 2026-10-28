import json
import re
from typing import Optional, Dict, Any, List
import httpx

from app.providers.base import LLMProvider
from app.providers.exceptions import ProviderUnavailable, ProviderResponseError
from app.schemas.facial_report import FacialReportSchema

ANALYSIS_SYSTEM_PROMPT = """You are a certified forensic facial composite specialist and criminal investigative analyst.
Your mission is to convert witness statements into an objective, standardized facial feature report.

CRITICAL FORENSIC RULES:
1. ONLY populate features explicitly described by the witness or documented in input.
2. For any feature NOT mentioned or uncertain, use null or omit it. NEVER hallucinate or invent features.
3. Classify every feature into one of the four categories:
   - 'stated_by_witness': exact physical attributes directly stated by the witness.
   - 'observed_from_image': attributes directly observed if a reference photo is provided.
   - 'unknown': attributes not specified or unclear.
   - 'ambiguous': conflicting, vague, or contradictory attributes.
4. Output MUST strictly be valid JSON conforming to this structure:
{
  "summary": "Objective forensic narrative summary",
  "features": {
    "face_shape": "e.g. oval, square, round, heart, oblong or null",
    "skin_tone": "e.g. fair, medium, olive, dark or null",
    "age_estimate": "e.g. 25-30 years or null",
    "gender_expression": "e.g. masculine, feminine, androgynous or null",
    "eye_color": "e.g. brown, hazel, blue, green or null",
    "eye_shape": "e.g. almond, hooded, deep-set, round or null",
    "eyebrows": "e.g. thick arched, sparse straight, bushy or null",
    "nose_shape": "e.g. straight narrow, broad hooked, button or null",
    "lips": "e.g. thin, full, defined cupid bow or null",
    "jawline": "e.g. sharp angular, soft rounded, prominent chin or null",
    "hair_color": "e.g. dark brown, jet black, blonde, graying or null",
    "hair_style": "e.g. short buzz cut, wavy parted, curly fade or null",
    "hair_length": "e.g. short, medium, long, shaved or null",
    "facial_hair": "e.g. clean shaven, heavy stubble, goatee, full beard or null",
    "distinguishing_marks": "e.g. scar on left cheek, mole above right lip or null",
    "accessories": "e.g. glasses, baseball cap or null"
  },
  "stated_by_witness": ["list", "of", "keys"],
  "observed_from_image": [],
  "unknown": ["list", "of", "unspecified", "keys"],
  "ambiguous": []
}
5. NEVER identify real individuals, speculate on names, or make unfounded demographic guesses.
"""

REFINEMENT_SYSTEM_PROMPT = """You are a forensic facial composite technician.
The operator wants to refine an existing facial composite report based on witness feedback.
Compute feature deltas from the natural language instruction.
CRITICAL RULE: If the instruction introduces an entirely new physical feature not supported by the original statement,
flag 'unsupported_feature': true and specify the delta, so the operator must confirm it before generation.
Return valid JSON with keys:
- 'deltas': dict of changed feature fields (e.g. {"jawline": "wider square jaw", "hair_style": "shorter crop"})
- 'requires_confirmation': bool
- 'reason': explanation of changes
"""


class GroqLLMProvider(LLMProvider):
    def __init__(self, api_key: str, model: str = "openai/gpt-oss-120b"):
        if not api_key:
            raise ProviderUnavailable("Groq API key is missing")
        self.api_key = api_key
        self.model = model or "openai/gpt-oss-120b"
        self.base_url = "https://api.groq.com/openai/v1"

    def _clean_json_text(self, text: str) -> str:
        text = text.strip()
        match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
        if match:
            text = match.group(1).strip()
        return text

    def _normalize_report_dict(self, data: Dict[str, Any]) -> Dict[str, Any]:
        # If features is returned as a list of {"feature": k, "value": v} or {"name": k, "value": v}
        raw_features = data.get("features")
        if isinstance(raw_features, list):
            norm_features = {}
            for item in raw_features:
                if isinstance(item, dict):
                    k = item.get("feature") or item.get("name") or item.get("key")
                    v = item.get("value")
                    if k:
                        norm_features[str(k).lower().replace(" ", "_")] = v
            data["features"] = norm_features
        elif not isinstance(raw_features, dict):
            data["features"] = {}

        if not isinstance(data.get("stated_by_witness"), list):
            data["stated_by_witness"] = []
        if not isinstance(data.get("observed_from_image"), list):
            data["observed_from_image"] = []
        if not isinstance(data.get("unknown"), list):
            data["unknown"] = []
        if not isinstance(data.get("ambiguous"), list):
            data["ambiguous"] = []
        if not data.get("summary"):
            data["summary"] = "Forensic witness facial feature description extracted via Groq LLM."
        return data

    def analyze(
        self,
        description: str,
        structured_fields: Optional[Dict[str, Any]] = None
    ) -> FacialReportSchema:
        user_content = f"Witness Free Text Statement:\n\"\"\"{description}\"\"\"\n\n"
        if structured_fields:
            user_content += f"Additional Structured Witness Fields:\n{json.dumps(structured_fields, indent=2)}\n"

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": ANALYSIS_SYSTEM_PROMPT},
                {"role": "user", "content": user_content}
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.1
        }

        try:
            with httpx.Client(timeout=45.0) as client:
                res = client.post(f"{self.base_url}/chat/completions", headers=headers, json=payload)
                if res.status_code != 200:
                    raise ProviderResponseError(f"Groq API error ({res.status_code}): {res.text}")
                data = res.json()
                raw_json = data["choices"][0]["message"]["content"]
                cleaned = self._clean_json_text(raw_json)
                parsed = json.loads(cleaned)
                normalized = self._normalize_report_dict(parsed)
                return FacialReportSchema.model_validate(normalized)
        except json.JSONDecodeError as e:
            raise ProviderResponseError(f"Failed to parse Groq JSON response: {str(e)}")
        except Exception as e:
            if isinstance(e, (ProviderUnavailable, ProviderResponseError)):
                raise
            raise ProviderResponseError(f"Groq request failed: {str(e)}")

    def refine_features(
        self,
        current_report: Dict[str, Any],
        instruction: str
    ) -> Dict[str, Any]:
        user_content = (
            f"Current Facial Report Features:\n{json.dumps(current_report.get('features', {}), indent=2)}\n\n"
            f"Witness Feedback / Refinement Instruction:\n\"{instruction}\"\n"
        )
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": REFINEMENT_SYSTEM_PROMPT},
                {"role": "user", "content": user_content}
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.1
        }
        try:
            with httpx.Client(timeout=30.0) as client:
                res = client.post(f"{self.base_url}/chat/completions", headers=headers, json=payload)
                if res.status_code != 200:
                    raise ProviderResponseError(f"Groq refinement error ({res.status_code}): {res.text}")
                data = res.json()
                raw = self._clean_json_text(data["choices"][0]["message"]["content"])
                return json.loads(raw)
        except Exception as e:
            if isinstance(e, (ProviderUnavailable, ProviderResponseError)):
                raise
            raise ProviderResponseError(f"Groq refinement request failed: {str(e)}")

    def extract_vision_features(
        self,
        image_bytes: bytes,
        mime: str
    ) -> Dict[str, Any]:
        # Groq text models do not process direct binary images; return empty observation
        return {"observations": [], "features": {}}
