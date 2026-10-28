import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.database.session import Base


class Case(Base):
    __tablename__ = "cases"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    case_number = Column(String(50), unique=True, index=True, nullable=False)
    title = Column(String(255), nullable=False)
    external_reference = Column(String(100), nullable=True)
    status = Column(String(50), default="draft", nullable=False, index=True)
    created_by = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    creator = relationship("User", back_populates="cases")
    inputs = relationship("WitnessInput", back_populates="case", cascade="all, delete-orphan")
    reports = relationship("FacialReport", back_populates="case", cascade="all, delete-orphan")
    sketches = relationship("GeneratedSketch", back_populates="case", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="case", cascade="all, delete-orphan")


Index("ix_cases_created_by_status", Case.created_by, Case.status)
