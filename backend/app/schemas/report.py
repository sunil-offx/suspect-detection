from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from app.schemas.facial_report import FacialFeatures


class FacialReportUpdate(BaseModel):
    summary: Optional[str] = None
    features: Optional[Dict[str, Any]] = None
    stated_by_witness: Optional[List[str]] = None
    observed_from_image: Optional[List[str]] = None
    unknown: Optional[List[str]] = None
    ambiguous: Optional[List[str]] = None


class FacialReportRead(BaseModel):
    id: str
    case_id: str
    report_version: int
    summary: str
    features: Dict[str, Any]
    stated_by_witness: List[str]
    observed_from_image: List[str]
    unknown: List[str]
    ambiguous: List[str]
    created_at: datetime
    updated_at: datetime
    original_witness_statements: Optional[List[str]] = None

    class Config:
        from_attributes = True
