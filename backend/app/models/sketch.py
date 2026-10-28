import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Integer, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.database.session import Base


class GeneratedSketch(Base):
    __tablename__ = "generated_sketches"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    case_id = Column(String(36), ForeignKey("cases.id", ondelete="CASCADE"), nullable=False, index=True)
    sketch_version = Column(Integer, nullable=False)
    generation_prompt_version = Column(String(50), nullable=False, default="sketch_v1")
    prompt_used = Column(Text, nullable=False)
    image_reference = Column(String(255), nullable=False)
    refinement_notes = Column(Text, nullable=True)
    created_by = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    case = relationship("Case", back_populates="sketches")

    __table_args__ = (
        UniqueConstraint("case_id", "sketch_version", name="uq_case_sketch_version"),
    )
