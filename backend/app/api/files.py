from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pathlib import Path
from typing import Optional
import mimetypes

from app.database.session import get_db
from app.models.user import User
from app.models.case import Case
from app.models.witness_input import WitnessInput
from app.models.sketch import GeneratedSketch
from app.security.deps import get_current_user_optional
from app.services.storage import storage
from app.services.audit import log_action

router = APIRouter(prefix="/api/files", tags=["Private Files"])


@router.get("/{token}")
def get_private_file(
    token: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    # Locate referencing case
    case_id = None
    input_ref = db.query(WitnessInput).filter(
        (WitnessInput.audio_reference == token) | (WitnessInput.image_reference == token)
    ).first()
    if input_ref:
        case_id = input_ref.case_id

    if not case_id:
        sketch_ref = db.query(GeneratedSketch).filter(GeneratedSketch.image_reference == token).first()
        if sketch_ref:
            case_id = sketch_ref.case_id

    # If associated with a case and an authenticated non-admin user is present, verify authorization
    if case_id and current_user and current_user.role != "admin":
        case = db.query(Case).filter(Case.id == case_id).first()
        if case and case.created_by != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied for this file")

    file_path = storage.get_file_path(token)
    if not file_path or not file_path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    client_ip = request.client.host if request.client else None
    log_action(
        db=db,
        user_id=current_user.id if current_user else None,
        case_id=case_id,
        action="file_read",
        details={"token": token},
        ip_address=client_ip
    )

    mime_type, _ = mimetypes.guess_type(str(file_path))
    return FileResponse(file_path, media_type=mime_type or "application/octet-stream")
