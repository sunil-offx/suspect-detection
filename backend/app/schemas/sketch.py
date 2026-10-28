from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field


class SketchRead(BaseModel):
    id: str
    case_id: str
    sketch_version: int
    generation_prompt_version: str
    prompt_used: str
    image_reference: str
    refinement_notes: Optional[str] = None
    created_at: datetime
    image_url: Optional[str] = None

    class Config:
        from_attributes = True


class RefineSketchRequest(BaseModel):
    instruction: Optional[str] = Field(
        default="Facial structure adjustment",
        description="Natural language refinement instruction, e.g. 'broader jawline'"
    )
    confirmed: bool = Field(False, description="Confirmation flag required if deltas introduce unsupported features")
    deltas: Optional[Dict[str, Any]] = Field(None, description="Optional explicit delta overrides")


class RefineSketchResponse(BaseModel):
    requires_confirmation: bool
    reason: str
    deltas: Dict[str, Any]
    generated: bool
    sketch: Optional[SketchRead] = None
