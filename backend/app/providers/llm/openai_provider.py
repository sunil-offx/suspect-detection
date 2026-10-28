import json
import base64
from typing import Optional, Dict, Any
import httpx

from app.providers.base import LLMProvider
from app.providers.exceptions import ProviderUnavailable, ProviderResponseError
from app.schemas.facial_report import FacialReportSchema

ANALYSIS_SYSTEM_PROMPT = """You are a certified forensic facial composite specialist and criminal investigative analyst.
Your mission is to convert witness statements into an objective, standardized facial feature report.

CRITICAL FORENSIC RULES:
1. ONLY populate features explicitly described by the witness or documented in input.
2. For any feature NOT mentioned or uncertain, use NULL (or omit). NEVER hallucinate or invent features.
3. Classify every feature into one of the four categories:
   - 'stated_by_witness': exact physical attributes directly stated by the witness.
   - 'observed_from_image': attributes directly observed if a reference photo is provided.
   - 'unknown': attributes not specified or unclear.
   - 'ambiguous': conflicting, vague, or contradictory attributes.
4. Output MUST strictly be valid JSON conforming to FacialReportSchema with keys:
   summary, features, stated_by_witness, observed_from_image, unknown, ambiguous.
5. NEVER identify real individuals, speculate on names, or make unfounded demographic guesses.
"""

REFINEMENT_SYSTEM_PROMPT = """You are a forensic facial composite technician.
The operator wants to refine an existing facial composite report based on witness feedback.
Compute feature deltas from the natural language instruction.
CRITICAL RULE: If the instruction introduces an entirely new physical feature not supported by the original statement,
flag 'unsupported_feature': true and specify the delta, so the operator must confirm it before generation.
Return JSON with keys:
- 'deltas': dict of changed feature fields
- 'requires_confirmation': bool
- 'reason': explanation of changes
"""


class OpenAILLMProvider(LLMProvider):
    def __init__(self, api_key: str, model: str = "gpt-4o-mini"):
        if not api_key:
            raise ProviderUnavailable("OpenAI API key is missing")
        self.api_key = api_key
        self.model = model
        self.base_url = "https://api.openai.com/v1"

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
                    raise ProviderResponseError(f"OpenAI error ({res.status_code}): {res.text}")
                data = res.json()
                raw_json = data["choices"][0]["message"]["content"]
                parsed = json.loads(raw_json)
                return FacialReportSchema.model_validate(parsed)
        except json.JSONDecodeError as e:
            raise ProviderResponseError(f"Failed to parse OpenAI JSON response: {str(e)}")
        except Exception as e:
            if isinstance(e, (ProviderUnavailable, ProviderResponseError)):
                raise
            raise ProviderResponseError(f"OpenAI request failed: {str(e)}")

    def extract_vision_features(
        self,
        image_bytes: bytes,
        mime: str
    ) -> Dict[str, Any]:
        b64_image = base64.b64encode(image_bytes).decode("utf-8")
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": self.model,
            "messages": [
                {
                    "role": "system",
                    "content": "You are a forensic analyst. Describe observable facial physical attributes visible in this image (e.g. face shape, nose width, eye spacing, hair length). NEVER guess identity, names, or unobservable traits. Return JSON with 'observations': list of strings and 'features': dict of visible facial features."
                },
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "Extract observable forensic facial attributes only."},
                        {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64_image}"}}
                    ]
                }
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.1
        }

        try:
            with httpx.Client(timeout=45.0) as client:
                res = client.post(f"{self.base_url}/chat/completions", headers=headers, json=payload)
                if res.status_code != 200:
                    raise ProviderResponseError(f"OpenAI vision error ({res.status_code}): {res.text}")
                data = res.json()
                raw_json = data["choices"][0]["message"]["content"]
                return json.loads(raw_json)
        except Exception as e:
            raise ProviderResponseError(f"OpenAI vision call failed: {str(e)}")

    def refine_features(
        self,
        current_report: Dict[str, Any],
        instruction: str
    ) -> Dict[str, Any]:
        user_prompt = f"Current Confirmed Report:\n{json.dumps(current_report, indent=2)}\n\nRefinement Instruction:\n\"{instruction}\""
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": REFINEMENT_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt}
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.1
        }

        try:
            with httpx.Client(timeout=30.0) as client:
                res = client.post(f"{self.base_url}/chat/completions", headers=headers, json=payload)
                if res.status_code != 200:
                    raise ProviderResponseError(f"OpenAI refine error ({res.status_code}): {res.text}")
                data = res.json()
                return json.loads(data["choices"][0]["message"]["content"])
        except Exception as e:
            raise ProviderResponseError(f"OpenAI refinement failed: {str(e)}")
