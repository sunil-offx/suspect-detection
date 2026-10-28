from pathlib import Path
from typing import Dict, Any, Tuple
import logging

logger = logging.getLogger("crimesketch.prompt")

PROMPT_DIR = Path(__file__).resolve().parent / "prompts"


def build_sketch_prompt(features: Dict[str, Any], prompt_version: str = "sketch_v1") -> Tuple[str, str]:
    template_path = PROMPT_DIR / f"{prompt_version}.txt"
    if not template_path.is_file():
        raise ValueError(f"Prompt template version not found: {prompt_version}")

    with open(template_path, "r", encoding="utf-8") as f:
        template = f.read()

    # Default neutral text for unspecified fields
    def get_val(key: str) -> str:
        v = features.get(key)
        if not v or str(v).lower() in ("null", "none", "unknown"):
            return "unspecified, render neutral"
        return str(v)

    prompt = template.format(
        face_shape=get_val("face_shape"),
        jawline=get_val("jawline"),
        eyebrows=get_val("eyebrows"),
        eye_shape=get_val("eye_shape"),
        eye_color=get_val("eye_color"),
        nose_shape=get_val("nose_shape"),
        lips=get_val("lips"),
        hair_style=get_val("hair_style"),
        hair_length=get_val("hair_length"),
        hair_color=get_val("hair_color"),
        facial_hair=get_val("facial_hair"),
        skin_tone=get_val("skin_tone"),
        distinguishing_marks=get_val("distinguishing_marks"),
        age_estimate=get_val("age_estimate"),
        accessories=get_val("accessories"),
    )

    logger.info(f"Compiled sketch prompt (version {prompt_version}): {prompt[:120]}...")
    return prompt, prompt_version
