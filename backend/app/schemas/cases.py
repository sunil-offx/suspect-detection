from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class CaseCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=255, description="Case title or headline")
    external_reference: Optional[str] = Field(None, max_length=100, description="Optional law enforcement RMS reference")


class CaseUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=2, max_length=255)
    status: Optional[str] = Field(None, description="Case status: draft, in_progress, completed, closed")
    external_reference: Optional[str] = Field(None, max_length=100)


class CaseRead(BaseModel):
    id: str
    case_number: str
    title: str
    status: str
    external_reference: Optional[str] = None
    created_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CaseListItem(BaseModel):
    id: str
    case_number: str
    title: str
    status: str
    external_reference: Optional[str] = None
    created_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    reports_count: int = 0
    sketches_count: int = 0
    inputs_count: int = 0
    last_workflow_state: str = "draft"

    class Config:
        from_attributes = True


class CaseListResponse(BaseModel):
    items: List[CaseListItem]
    total: int
    page: int
    limit: int


class CaseStats(BaseModel):
    total: int
    in_progress: int
    completed: int
    recent: int
