import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Integer, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.database.session import Base


class FacialReport(Base):
    __tablename__ = "facial_reports"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    case_id = Column(String(36), ForeignKey("cases.id", ondelete="CASCADE"), nullable=False, index=True)
    report_version = Column(Integer, default=1, nullable=False)
    summary = Column(Text, nullable=False)
    features = Column(JSON, nullable=False, default=dict)
    stated_by_witness = Column(JSON, nullable=False, default=list)
    observed_from_image = Column(JSON, nullable=False, default=list)
    unknown = Column(JSON, nullable=False, default=list)
    ambiguous = Column(JSON, nullable=False, default=list)
    created_by = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    case = relationship("Case", back_populates="reports")
