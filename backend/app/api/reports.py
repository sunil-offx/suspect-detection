import json
from pathlib import Path
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional

from app.database.session import get_db
from app.models.case import Case
from app.models.witness_input import WitnessInput
from app.models.facial_report import FacialReport
from app.models.user import User
from app.schemas.report import FacialReportRead, FacialReportUpdate
from app.schemas.facial_report import FacialReportSchema
from app.security.deps import get_current_user
from app.services.audit import log_action
from app.providers import get_provider, ProviderUnavailable, ProviderResponseError
from app.core.config import settings

router = APIRouter(prefix="/api/cases/{case_id}", tags=["Facial Reports"])


def get_case_for_user(case_id: str, current_user: User, db: Session) -> Case:
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")
    if current_user.role != "admin" and case.created_by != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied for this case")
    return case


@router.post("/analyze", response_model=FacialReportRead, status_code=status.HTTP_201_CREATED)
def analyze_case_inputs(
    case_id: str,
    request: Request,
    use_fixture: bool = Query(False, description="Explicit dev-only fixture loader when DEV_FIXTURES=1"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    case = get_case_for_user(case_id, current_user, db)

    # Gather inputs
    inputs = db.query(WitnessInput).filter(WitnessInput.case_id == case.id).all()
    if not inputs:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot analyze case: no witness text or audio input submitted yet"
        )

    # Prioritize latest text input and any audio transcriptions
    texts = []
    structured_combined = {}

    latest_text = next((i for i in inputs if i.input_type == "text" and i.original_text), None)
    if latest_text:
        texts.append(latest_text.original_text)
        if latest_text.structured_data and isinstance(latest_text.structured_data, dict):
            structured_combined.update(latest_text.structured_data)

    for inp in inputs:
        if inp.input_type == "audio" and inp.transcription:
            texts.append(f"[Transcribed Audio]: {inp.transcription}")

    if not texts:
        for inp in inputs:
            if inp.original_text and inp.original_text not in texts:
                texts.append(inp.original_text)

    narrative = "\n\n".join(texts)

    # Check dev fixture mode
    report_schema: Optional[FacialReportSchema] = None
    if use_fixture:
        if not settings.DEV_FIXTURES:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="DEV_FIXTURES is disabled in server configuration"
            )
        fixture_path = Path(__file__).resolve().parent.parent / "fixtures" / "sample_facial_report.json"
        with open(fixture_path, "r", encoding="utf-8") as f:
            fixture_data = json.load(f)
            report_schema = FacialReportSchema.model_validate(fixture_data)
    else:
        # Call provider
        provider = get_provider("llm")
        # Try analyze with one retry on parsing failure
        attempts = 2
        last_error = None
        for attempt in range(attempts):
            try:
                report_schema = provider.analyze(narrative, structured_combined)
                break
            except ProviderUnavailable:
                raise
            except Exception as e:
                last_error = e
                if attempt == attempts - 1:
                    raise ProviderResponseError(f"LLM analysis failed after {attempts} attempts: {str(last_error)}")

    if not report_schema:
        raise ProviderResponseError("No report schema produced")

    # Determine next report version
    last_report = db.query(FacialReport).filter(
        FacialReport.case_id == case.id
    ).order_by(desc(FacialReport.report_version), desc(FacialReport.created_at)).first()
    next_version = (last_report.report_version + 1) if last_report else 1

    # Persist FacialReports row
    new_report = FacialReport(
        case_id=case.id,
        report_version=next_version,
        summary=report_schema.summary,
        features=report_schema.features.model_dump(),
        stated_by_witness=report_schema.stated_by_witness,
        observed_from_image=report_schema.observed_from_image,
        unknown=report_schema.unknown,
        ambiguous=report_schema.ambiguous,
        created_by=current_user.id
    )
    db.add(new_report)
    case.status = "in_progress"
    case.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(new_report)

    client_ip = request.client.host if request.client else None
    log_action(
        db=db,
        user_id=current_user.id,
        case_id=case.id,
        action="report_analyze",
        details={"report_id": new_report.id, "version": new_report.report_version},
        ip_address=client_ip
    )

    result = FacialReportRead.model_validate(new_report)
    result.original_witness_statements = [i.original_text for i in inputs if i.original_text]
    return result


@router.get("/report", response_model=FacialReportRead)
def get_latest_report(
    case_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    case = get_case_for_user(case_id, current_user, db)
    report = db.query(FacialReport).filter(
        FacialReport.case_id == case.id
    ).order_by(desc(FacialReport.report_version), desc(FacialReport.created_at)).first()

    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No facial report generated for this case yet"
        )

    inputs = db.query(WitnessInput).filter(WitnessInput.case_id == case.id).all()
    result = FacialReportRead.model_validate(report)
    result.original_witness_statements = [i.original_text for i in inputs if i.original_text]
    return result


@router.put("/report", response_model=FacialReportRead)
def update_report(
    case_id: str,
    payload: FacialReportUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    case = get_case_for_user(case_id, current_user, db)
    latest = db.query(FacialReport).filter(
        FacialReport.case_id == case.id
    ).order_by(desc(FacialReport.report_version), desc(FacialReport.created_at)).first()

    if not latest:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No report to update")

    # Bump version and update
    new_version = latest.report_version + 1
    updated_summary = payload.summary if payload.summary is not None else latest.summary
    updated_features = payload.features if payload.features is not None else latest.features
    updated_stated = payload.stated_by_witness if payload.stated_by_witness is not None else latest.stated_by_witness
    updated_observed = payload.observed_from_image if payload.observed_from_image is not None else latest.observed_from_image
    updated_unknown = payload.unknown if payload.unknown is not None else latest.unknown
    updated_ambiguous = payload.ambiguous if payload.ambiguous is not None else latest.ambiguous

    # Create new version record to preserve complete version history
    new_report = FacialReport(
        case_id=case.id,
        report_version=new_version,
        summary=updated_summary,
        features=updated_features,
        stated_by_witness=updated_stated,
        observed_from_image=updated_observed,
        unknown=updated_unknown,
        ambiguous=updated_ambiguous,
        created_by=current_user.id
    )
    db.add(new_report)
    case.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(new_report)

    client_ip = request.client.host if request.client else None
    log_action(
        db=db,
        user_id=current_user.id,
        case_id=case.id,
        action="report_update",
        details={"report_id": new_report.id, "new_version": new_version},
        ip_address=client_ip
    )

    inputs = db.query(WitnessInput).filter(WitnessInput.case_id == case.id).all()
    result = FacialReportRead.model_validate(new_report)
    result.original_witness_statements = [i.original_text for i in inputs if i.original_text]
    return result
