from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class FacialFeatures(BaseModel):
    face_shape: Optional[str] = Field(None, description="e.g. oval, square, round, heart, oblong")
    skin_tone: Optional[str] = Field(None, description="e.g. fair, medium, olive, dark")
    age_estimate: Optional[str] = Field(None, description="e.g. 25-30 years")
    gender_expression: Optional[str] = Field(None, description="e.g. masculine, feminine, androgynous")
    eye_color: Optional[str] = Field(None, description="e.g. brown, hazel, blue, green")
    eye_shape: Optional[str] = Field(None, description="e.g. almond, hooded, deep-set, round")
    eyebrows: Optional[str] = Field(None, description="e.g. thick arched, sparse straight, bushy")
    nose_shape: Optional[str] = Field(None, description="e.g. straight narrow, broad hooked, button")
    lips: Optional[str] = Field(None, description="e.g. thin, full, defined cupid bow, uneven")
    jawline: Optional[str] = Field(None, description="e.g. sharp angular, soft rounded, prominent chin")
    hair_color: Optional[str] = Field(None, description="e.g. dark brown, jet black, blonde, graying")
    hair_style: Optional[str] = Field(None, description="e.g. short buzz cut, wavy parted, curly fade, bald")
    hair_length: Optional[str] = Field(None, description="e.g. short, medium, long, shaved")
    facial_hair: Optional[str] = Field(None, description="e.g. clean shaven, heavy stubble, goatee, full beard")
    distinguishing_marks: Optional[str] = Field(None, description="e.g. scar on left cheek, mole above right lip")
    accessories: Optional[str] = Field(None, description="e.g. wire-frame glasses, baseball cap, ear piercing")


class FacialReportSchema(BaseModel):
    summary: str = Field(..., description="Objective forensic summary of suspect appearance")
    features: FacialFeatures = Field(default_factory=FacialFeatures)
    stated_by_witness: List[str] = Field(default_factory=list, description="Features explicitly stated by witness")
    observed_from_image: List[str] = Field(default_factory=list, description="Features observed from reference image")
    unknown: List[str] = Field(default_factory=list, description="Features unspecified or unknown")
    ambiguous: List[str] = Field(default_factory=list, description="Features with conflicting or unclear witness statements")
