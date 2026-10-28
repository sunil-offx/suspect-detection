from fastapi import APIRouter, Depends, HTTPException, status, Request, UploadFile, File, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel, Field

from app.database.session import get_db
from app.models.case import Case
from app.models.witness_input import WitnessInput
from app.models.user import User
from app.schemas.witness_input import WitnessTextInput, WitnessInputRead
from app.security.deps import get_current_user
from app.services.audit import log_action
from app.services.storage import storage
from app.services.file_validation import validate_audio, validate_image, strip_exif_and_reencode
from app.providers import get_provider, ProviderUnavailable
from app.core.config import settings

router = APIRouter(prefix="/api/cases/{case_id}", tags=["Witness Inputs & Transcription"])


class TranscriptionUpdate(BaseModel):
    transcription: str = Field(..., min_length=2, description="Edited transcription text")


class ImageInputResponse(BaseModel):
    input_id: str
    image_reference: str
    needs_text_description: bool
    observations: List[str] = []
    features: dict = {}



def get_case_for_user(case_id: str, current_user: User, db: Session) -> Case:
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")
    if current_user.role != "admin" and case.created_by != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied for this case")
    return case


@router.post("/inputs/text", response_model=WitnessInputRead, status_code=status.HTTP_201_CREATED)
def submit_text_input(
    case_id: str,
    payload: WitnessTextInput,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    case = get_case_for_user(case_id, current_user, db)

    # Update existing text input for this case if present, else create new
    existing = db.query(WitnessInput).filter(
        WitnessInput.case_id == case.id,
        WitnessInput.input_type == "text"
    ).order_by(WitnessInput.created_at.desc()).first()

    if existing:
        existing.original_text = payload.text
        existing.structured_data = payload.structured_fields or {}
        witness_input = existing
    else:
        witness_input = WitnessInput(
            case_id=case.id,
            input_type="text",
            original_text=payload.text,
            structured_data=payload.structured_fields or {},
            created_by=current_user.id
        )
        db.add(witness_input)
    db.commit()
    db.refresh(witness_input)

    client_ip = request.client.host if request.client else None
    log_action(
        db=db,
        user_id=current_user.id,
        case_id=case.id,
        action="input_text_create",
        details={"input_id": witness_input.id, "text_length": len(payload.text)},
        ip_address=client_ip
    )

    return witness_input


@router.post("/inputs/audio", response_model=WitnessInputRead, status_code=status.HTTP_201_CREATED)
async def submit_audio_input(
    case_id: str,
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    case = get_case_for_user(case_id, current_user, db)

    content = await file.read()
    ext = validate_audio(content, file.filename or "audio.mp3")
    token = storage.save_file(content, ext, prefix="aud_")

    witness_input = WitnessInput(
        case_id=case.id,
        input_type="audio",
        audio_reference=token,
        created_by=current_user.id
    )
    db.add(witness_input)
    db.commit()
    db.refresh(witness_input)

    client_ip = request.client.host if request.client else None
    log_action(
        db=db,
        user_id=current_user.id,
        case_id=case.id,
        action="input_audio_upload",
        details={"input_id": witness_input.id, "audio_token": token, "size_bytes": len(content)},
        ip_address=client_ip
    )

    return witness_input


@router.post("/inputs/image", response_model=ImageInputResponse, status_code=status.HTTP_201_CREATED)
async def submit_image_input(
    case_id: str,
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    case = get_case_for_user(case_id, current_user, db)

    raw_content = await file.read()
    ext = validate_image(raw_content, file.filename or "reference.jpg")
    clean_bytes = strip_exif_and_reencode(raw_content, ext)
    token = storage.save_file(clean_bytes, ext, prefix="img_")

    # Try feature extraction via LLM vision call
    needs_text = True
    observations = []
    features = {}
    try:
        provider = get_provider("llm")
        mime = "image/jpeg" if ext in (".jpg", ".jpeg") else "image/png"
        extraction = provider.extract_vision_features(clean_bytes, mime)
        if extraction and isinstance(extraction, dict):
            observations = extraction.get("observations", [])
            features = extraction.get("features", {})
            if observations or features:
                needs_text = False
    except (ProviderUnavailable, NotImplementedError, Exception):
        # Vision unavailable or not supported -> needs_text_description: True
        needs_text = True

    witness_input = WitnessInput(
        case_id=case.id,
        input_type="image",
        image_reference=token,
        structured_data={"observations": observations, "features": features},
        created_by=current_user.id
    )
    db.add(witness_input)
    db.commit()
    db.refresh(witness_input)

    client_ip = request.client.host if request.client else None
    log_action(
        db=db,
        user_id=current_user.id,
        case_id=case.id,
        action="input_image_upload",
        details={"input_id": witness_input.id, "image_token": token, "needs_text_description": needs_text},
        ip_address=client_ip
    )

    return ImageInputResponse(
        input_id=witness_input.id,
        image_reference=token,
        needs_text_description=needs_text,
        observations=observations,
        features=features
    )



@router.post("/transcribe")
def transcribe_audio_input(
    case_id: str,
    request: Request,
    input_id: Optional[str] = Query(None, description="Optional specific audio input id"),
    use_fixture: bool = Query(False, description="Explicit dev fixture mode when DEV_FIXTURES=1"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    case = get_case_for_user(case_id, current_user, db)

    query = db.query(WitnessInput).filter(
        WitnessInput.case_id == case.id,
        WitnessInput.input_type == "audio"
    )
    if input_id:
        witness_input = query.filter(WitnessInput.id == input_id).first()
    else:
        witness_input = query.order_by(WitnessInput.created_at.desc()).first()

    if not witness_input or not witness_input.audio_reference:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No audio input found for this case to transcribe"
        )

    transcription_text = ""
    if use_fixture:
        if not settings.DEV_FIXTURES:
            raise HTTPException(status_code=403, detail="DEV_FIXTURES disabled")
        transcription_text = "The suspect was about 28 to 32 years old, approximately 5'11\", with an athletic build. He had short dark brown textured crop hair, deep-set hazel eyes, and a sharp defined jawline with a neat goatee."
    else:
        audio_bytes = storage.read_file(witness_input.audio_reference)
        if not audio_bytes:
            raise HTTPException(status_code=404, detail="Audio file not found in private storage")
        mime = "audio/wav" if witness_input.audio_reference.endswith(".wav") else "audio/mpeg"
        provider = get_provider("transcription")
        transcription_text = provider.transcribe(audio_bytes, mime)

    witness_input.transcription = transcription_text
    witness_input.transcription_edited = False
    db.commit()
    db.refresh(witness_input)

    client_ip = request.client.host if request.client else None
    log_action(
        db=db,
        user_id=current_user.id,
        case_id=case.id,
        action="audio_transcribe",
        details={"input_id": witness_input.id, "length": len(transcription_text)},
        ip_address=client_ip
    )

    return {"input_id": witness_input.id, "transcription": transcription_text}


@router.put("/inputs/{input_id}/transcription", response_model=WitnessInputRead)
def update_transcription(
    case_id: str,
    input_id: str,
    payload: TranscriptionUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    case = get_case_for_user(case_id, current_user, db)
    witness_input = db.query(WitnessInput).filter(
        WitnessInput.id == input_id,
        WitnessInput.case_id == case.id
    ).first()

    if not witness_input:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Witness input not found")

    old_transcription = witness_input.transcription

    client_ip = request.client.host if request.client else None
    log_action(
        db=db,
        user_id=current_user.id,
        case_id=case.id,
        action="transcription_edit",
        details={"input_id": witness_input.id, "original_transcription": old_transcription, "new_transcription": payload.transcription},
        ip_address=client_ip
    )

    witness_input.transcription = payload.transcription
    witness_input.transcription_edited = True
    db.commit()
    db.refresh(witness_input)

    return witness_input


@router.get("/inputs", response_model=List[WitnessInputRead])
def list_case_inputs(
    case_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    case = get_case_for_user(case_id, current_user, db)
    return db.query(WitnessInput).filter(WitnessInput.case_id == case.id).order_by(WitnessInput.created_at.asc()).all()
