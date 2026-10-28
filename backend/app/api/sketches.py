from pathlib import Path
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database.session import get_db
from app.models.case import Case
from app.models.facial_report import FacialReport
from app.models.sketch import GeneratedSketch
from app.models.witness_input import WitnessInput
from app.models.user import User
from app.schemas.sketch import SketchRead, RefineSketchRequest, RefineSketchResponse
from app.security.deps import get_current_user
from app.services.audit import log_action
from app.services.storage import storage
from app.services.sketch_prompt import build_sketch_prompt
from app.providers import get_provider, ProviderUnavailable, ProviderResponseError
from app.core.config import settings

router = APIRouter(prefix="/api/cases/{case_id}", tags=["Sketches"])


def get_case_for_user(case_id: str, current_user: User, db: Session) -> Case:
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")
    if current_user.role != "admin" and case.created_by != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied for this case")
    return case


@router.post("/generate-sketch", response_model=SketchRead, status_code=status.HTTP_201_CREATED)
def generate_sketch(
    case_id: str,
    request: Request,
    use_fixture: bool = Query(False, description="Explicit dev-only fixture loader when DEV_FIXTURES=1"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    case = get_case_for_user(case_id, current_user, db)

    # Fetch latest confirmed report
    report = db.query(FacialReport).filter(
        FacialReport.case_id == case.id
    ).order_by(desc(FacialReport.report_version), desc(FacialReport.created_at)).first()

    if not report:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot generate sketch: no confirmed facial report exists for this case"
        )

    prompt, prompt_version = build_sketch_prompt(report.features or {}, prompt_version="sketch_v1")

    png_bytes: bytes
    if use_fixture:
        if not settings.DEV_FIXTURES:
            raise HTTPException(status_code=403, detail="DEV_FIXTURES disabled")
        fixture_path = Path(__file__).resolve().parent.parent / "fixtures" / "sample_sketch.png"
        with open(fixture_path, "rb") as f:
            png_bytes = f.read()
    else:
        provider = get_provider("image")
        png_bytes = provider.generate(prompt)

    # Save to private storage
    token = storage.save_file(png_bytes, "png", prefix="sketch_")

    # Determine next sketch version
    last_sketch = db.query(GeneratedSketch).filter(
        GeneratedSketch.case_id == case.id
    ).order_by(desc(GeneratedSketch.sketch_version)).first()
    next_version = (last_sketch.sketch_version + 1) if last_sketch else 1

    sketch = GeneratedSketch(
        case_id=case.id,
        sketch_version=next_version,
        generation_prompt_version=prompt_version,
        prompt_used=prompt,
        image_reference=token,
        created_by=current_user.id
    )
    db.add(sketch)
    case.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(sketch)

    client_ip = request.client.host if request.client else None
    log_action(
        db=db,
        user_id=current_user.id,
        case_id=case.id,
        action="sketch_generate",
        details={"sketch_id": sketch.id, "version": next_version, "prompt_version": prompt_version},
        ip_address=client_ip
    )

    result = SketchRead.model_validate(sketch)
    result.image_url = f"/api/files/{token}"
    return result


@router.get("/sketches", response_model=List[SketchRead])
def list_case_sketches(
    case_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    case = get_case_for_user(case_id, current_user, db)
    sketches = db.query(GeneratedSketch).filter(
        GeneratedSketch.case_id == case.id
    ).order_by(desc(GeneratedSketch.sketch_version)).all()

    output = []
    for s in sketches:
        item = SketchRead.model_validate(s)
        item.image_url = f"/api/files/{s.image_reference}"
        output.append(item)
    return output


@router.get("/sketches/{version}", response_model=SketchRead)
def get_case_sketch_by_version(
    case_id: str,
    version: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    case = get_case_for_user(case_id, current_user, db)
    sketch = db.query(GeneratedSketch).filter(
        GeneratedSketch.case_id == case.id,
        GeneratedSketch.sketch_version == version
    ).first()

    if not sketch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Sketch version {version} not found")

    item = SketchRead.model_validate(sketch)
    item.image_url = f"/api/files/{sketch.image_reference}"
    return item


@router.post("/refine-sketch", response_model=RefineSketchResponse)
def refine_sketch(
    case_id: str,
    payload: RefineSketchRequest,
    request: Request,
    use_fixture: bool = Query(False, description="Explicit dev-only fixture loader when DEV_FIXTURES=1"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    case = get_case_for_user(case_id, current_user, db)

    # Latest confirmed report
    report = db.query(FacialReport).filter(
        FacialReport.case_id == case.id
    ).order_by(desc(FacialReport.report_version), desc(FacialReport.created_at)).first()

    if not report:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot refine sketch: no confirmed facial report exists for this case"
        )

    # 1. Compute feature deltas from instruction
    deltas = payload.deltas or {}
    requires_confirmation = False
    reason = "Refinement instruction processed successfully."

    # Parse common forensic terms if deltas not explicitly passed
    instr_text = (payload.instruction or "").strip() or "Facial structure adjustment"
    instr_lower = instr_text.lower()
    if not deltas:
        if "jaw" in instr_lower or "jawline" in instr_lower or "chin" in instr_lower:
            deltas["jawline"] = "broad, square, prominent angular jawline with wide mandibular angle"
        elif "nose" in instr_lower:
            deltas["nose_shape"] = "narrow, straight, refined nasal bridge"
        elif "eyebrow" in instr_lower:
            deltas["eyebrows"] = "thicker, dense, pronounced arched eyebrows"
        elif "glasses" in instr_lower:
            deltas["accessories"] = "wire-frame rectangular spectacles"
        elif "beard" in instr_lower or "stubble" in instr_lower:
            deltas["facial_hair"] = "heavy rugged stubble and trimmed beard"
        else:
            deltas["summary_note"] = payload.instruction

    # 2. Check if delta introduces a feature not supported by witness input
    inputs = db.query(WitnessInput).filter(WitnessInput.case_id == case.id).all()
    combined_witness_text = " ".join(
        [(i.original_text or "") for i in inputs] + [(i.transcription or "") for i in inputs]
    ).lower()

    unsupported_keys = []
    for key, val in deltas.items():
        if key in ("summary_note",):
            continue
        # Check if attribute was mentioned in witness statements or existing features
        attr_name = key.replace("_", " ")
        orig_feature_val = (report.features or {}).get(key)
        if (not orig_feature_val or orig_feature_val == "unspecified") and (key not in combined_witness_text and attr_name not in combined_witness_text):
            unsupported_keys.append(key)

    if unsupported_keys:
        requires_confirmation = True
        reason = (
            f"The refinement introduces new features not supported by original witness statement: {unsupported_keys}. "
            f"Operator confirmation is required to avoid forensic fabrication."
        )

    # If requires confirmation and not confirmed, BLOCK generation
    if requires_confirmation and not payload.confirmed:
        return RefineSketchResponse(
            requires_confirmation=True,
            reason=reason,
            deltas=deltas,
            generated=False,
            sketch=None
        )

    # 3. Confirmed or supported -> apply deltas, bump report version, generate new sketch version
    updated_features = dict(report.features or {})
    updated_features.update(deltas)

    new_report_version = report.report_version + 1
    new_report = FacialReport(
        case_id=case.id,
        report_version=new_report_version,
        summary=f"{report.summary} [Refinement applied: {instr_text}]",
        features=updated_features,
        stated_by_witness=report.stated_by_witness,
        observed_from_image=report.observed_from_image,
        unknown=report.unknown,
        ambiguous=report.ambiguous,
        created_by=current_user.id
    )
    db.add(new_report)

    # Compile prompt from new features
    prompt, prompt_version = build_sketch_prompt(updated_features, prompt_version="sketch_v1")

    # Generate image bytes
    if use_fixture:
        if not settings.DEV_FIXTURES:
            raise HTTPException(status_code=403, detail="DEV_FIXTURES disabled")
        fixture_path = Path(__file__).resolve().parent.parent / "fixtures" / "sample_sketch.png"
        with open(fixture_path, "rb") as f:
            png_bytes = f.read()
    else:
        provider = get_provider("image")
        png_bytes = provider.generate(prompt)

    # Save to storage (never overwriting prior file!)
    token = storage.save_file(png_bytes, "png", prefix="sketch_")

    last_sketch = db.query(GeneratedSketch).filter(
        GeneratedSketch.case_id == case.id
    ).order_by(desc(GeneratedSketch.sketch_version)).first()
    next_sketch_version = (last_sketch.sketch_version + 1) if last_sketch else 1

    new_sketch = GeneratedSketch(
        case_id=case.id,
        sketch_version=next_sketch_version,
        generation_prompt_version=prompt_version,
        prompt_used=prompt,
        image_reference=token,
        refinement_notes=instr_text,
        created_by=current_user.id
    )
    db.add(new_sketch)
    case.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(new_sketch)

    client_ip = request.client.host if request.client else None
    log_action(
        db=db,
        user_id=current_user.id,
        case_id=case.id,
        action="sketch_refine",
        details={
            "instruction": instr_text,
            "deltas": deltas,
            "new_sketch_version": next_sketch_version,
            "new_report_version": new_report_version
        },
        ip_address=client_ip
    )

    sketch_read = SketchRead.model_validate(new_sketch)
    sketch_read.image_url = f"/api/files/{token}"

    return RefineSketchResponse(
        requires_confirmation=False,
        reason="Refinement applied and new sketch version generated",
        deltas=deltas,
        generated=True,
        sketch=sketch_read
    )

