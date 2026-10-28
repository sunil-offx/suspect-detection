import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.database.session import Base


class WitnessInput(Base):
    __tablename__ = "witness_inputs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    case_id = Column(String(36), ForeignKey("cases.id", ondelete="CASCADE"), nullable=False, index=True)
    input_type = Column(String(20), nullable=False)  # text, audio, image
    original_text = Column(Text, nullable=True)      # immutable raw statement
    structured_data = Column(JSON, nullable=True)    # optional structured field key-values
    audio_reference = Column(String(255), nullable=True)
    image_reference = Column(String(255), nullable=True)
    transcription = Column(Text, nullable=True)
    transcription_edited = Column(Boolean, default=False, nullable=False)
    created_by = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    case = relationship("Case", back_populates="inputs")
