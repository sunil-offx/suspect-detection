from pathlib import Path
from typing import Dict, Any, Tuple
import logging

logger = logging.getLogger("crimesketch.prompt")

PROMPT_DIR = Path(__file__).resolve().parent / "prompts"


def is_valid_attr(val: Any) -> bool:
    if val is None:
        return False
    s = str(val).strip().lower()
    return bool(s and s not in ("null", "none", "unknown", "unspecified", "render neutral", "n/a"))


def build_sketch_prompt(features: Dict[str, Any], prompt_version: str = "sketch_v1") -> Tuple[str, str]:
    """
    Constructs an authentic, high-fidelity forensic composite prompt.
    Extracts only confirmed suspect descriptors and avoids littering the prompt
    with negative or confusing 'unspecified' tokens.
    """
    f = features or {}

    # Extract valid attributes
    gender = f.get("gender_expression")
    age = f.get("age_estimate")
    face_shape = f.get("face_shape")
    jawline = f.get("jawline")
    eyebrows = f.get("eyebrows")
    eye_shape = f.get("eye_shape")
    eye_color = f.get("eye_color")
    nose_shape = f.get("nose_shape")
    lips = f.get("lips")
    hair_style = f.get("hair_style")
    hair_length = f.get("hair_length")
    hair_color = f.get("hair_color")
    facial_hair = f.get("facial_hair")
    skin_tone = f.get("skin_tone")
    marks = f.get("distinguishing_marks")
    accessories = f.get("accessories")

    # Build demographic intro
    subject_parts = []
    if is_valid_attr(gender):
        subject_parts.append(f"{gender.lower()} suspect")
    else:
        subject_parts.append("suspect")

    if is_valid_attr(age):
        age_str = str(age).strip()
        # Clean redundant 'years' suffix if already present
        age_clean = age_str.lower().replace("years old", "").replace("years of age", "").replace("years", "").strip()
        subject_parts.append(f"approximately {age_clean} years of age")

    demographics = ", ".join(subject_parts)

    # Build anatomical facial features
    feature_clauses = []

    # Face and jaw
    face_details = []
    if is_valid_attr(face_shape):
        face_details.append(f"{face_shape} face shape")
    if is_valid_attr(jawline):
        face_details.append(f"{jawline}")
    if is_valid_attr(skin_tone):
        face_details.append(f"{skin_tone} complexion")
    if face_details:
        feature_clauses.append(f"Facial structure: {', '.join(face_details)}")

    # Eyes & Eyebrows
    eye_details = []
    if is_valid_attr(eye_shape) and is_valid_attr(eye_color):
        eye_details.append(f"{eye_shape} {eye_color} eyes")
    elif is_valid_attr(eye_shape):
        eye_details.append(f"{eye_shape} eyes")
    elif is_valid_attr(eye_color):
        eye_details.append(f"{eye_color} eyes")
    if is_valid_attr(eyebrows):
        eye_details.append(f"{eyebrows} eyebrows")
    if eye_details:
        feature_clauses.append(f"Eyes: {', '.join(eye_details)}")

    # Nose & Mouth
    lower_face = []
    if is_valid_attr(nose_shape):
        lower_face.append(f"{nose_shape} nose")
    if is_valid_attr(lips):
        lower_face.append(f"{lips} lips")
    if lower_face:
        feature_clauses.append(f"Features: {', '.join(lower_face)}")

    # Hair
    hair_details = []
    if is_valid_attr(hair_length):
        hair_details.append(str(hair_length))
    if is_valid_attr(hair_style):
        hair_details.append(str(hair_style))
    if is_valid_attr(hair_color):
        hair_details.append(f"{hair_color} hair")
    elif hair_details:
        hair_details.append("hair")
    if hair_details:
        feature_clauses.append(f"Hair: {' '.join(hair_details)}")

    # Facial hair
    if is_valid_attr(facial_hair):
        feature_clauses.append(f"Facial hair: {facial_hair}")

    # Marks & Scars
    if is_valid_attr(marks):
        feature_clauses.append(f"Distinguishing marks: {marks}")

    # Accessories
    if is_valid_attr(accessories):
        feature_clauses.append(f"Accessories: {accessories}")

    # Format into cohesive forensic prompt
    features_block = ". ".join(feature_clauses)
    if features_block:
        features_block = f" Key observed features: {features_block}."

    prompt = (
        f"Masterpiece authentic police forensic facial composite sketch of a {demographics}.{features_block} "
        f"Professional law enforcement artist composite drawing, hand-drawn graphite pencil and charcoal on white paper. "
        f"Crisp forensic linework, delicate cross-hatching shading, realistic facial anatomy and symmetry, "
        f"front-facing eye-level bust portrait, neutral serious expression, sharp focus, monochrome grayscale, high resolution."
    )

    logger.info(f"Compiled sketch prompt (v={prompt_version}): {prompt[:140]}...")
    return prompt, prompt_version
