from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field


class WitnessTextInput(BaseModel):
    text: str = Field(..., min_length=5, description="Witness raw verbal or written narrative")
    structured_fields: Optional[Dict[str, Any]] = Field(None, description="Optional structured observations")


class WitnessInputRead(BaseModel):
    id: str
    case_id: str
    input_type: str
    original_text: Optional[str]
    structured_data: Optional[Dict[str, Any]]
    audio_reference: Optional[str]
    image_reference: Optional[str]
    transcription: Optional[str]
    transcription_edited: bool
    created_at: datetime

    class Config:
        from_attributes = True
