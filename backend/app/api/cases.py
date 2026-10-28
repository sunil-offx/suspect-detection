import random
import string
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.database.session import get_db
from app.models.case import Case
from app.models.witness_input import WitnessInput
from app.models.facial_report import FacialReport
from app.models.sketch import GeneratedSketch
from app.models.audit_log import AuditLog
from app.models.user import User
from app.schemas.cases import CaseCreate, CaseUpdate, CaseRead, CaseListItem, CaseListResponse, CaseStats
from app.security.deps import get_current_user
from app.services.audit import log_action

router = APIRouter(prefix="/api/cases", tags=["Cases"])


def generate_case_number(db: Session) -> str:
    date_str = datetime.now(timezone.utc).strftime("%Y%m%d")
    for _ in range(10):
        suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=4))
        case_num = f"CS-{date_str}-{suffix}"
        if not db.query(Case).filter(Case.case_number == case_num).first():
            return case_num
    raise RuntimeError("Failed to generate unique case number")


@router.post("", response_model=CaseRead, status_code=status.HTTP_201_CREATED)
def create_case(
    payload: CaseCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    case_number = generate_case_number(db)
    case = Case(
        case_number=case_number,
        title=payload.title,
        external_reference=payload.external_reference,
        status="draft",
        created_by=current_user.id
    )
    db.add(case)
    db.commit()
    db.refresh(case)

    client_ip = request.client.host if request.client else None
    log_action(
        db=db,
        user_id=current_user.id,
        case_id=case.id,
        action="case_create",
        details={"case_number": case.case_number, "title": case.title},
        ip_address=client_ip
    )

    return case


@router.get("/stats", response_model=CaseStats)
def get_case_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Case)
    if current_user.role != "admin":
        query = query.filter(Case.created_by == current_user.id)

    total = query.count()
    in_progress = query.filter(Case.status == "in_progress").count()
    completed = query.filter(Case.status == "completed").count()

    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
    recent = query.filter(Case.created_at >= seven_days_ago).count()

    return CaseStats(
        total=total,
        in_progress=in_progress,
        completed=completed,
        recent=recent
    )


@router.get("", response_model=CaseListResponse)
def list_cases(
    status_filter: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Case)
    if current_user.role != "admin":
        query = query.filter(Case.created_by == current_user.id)

    if status_filter:
        query = query.filter(Case.status == status_filter)

    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            or_(
                Case.case_number.ilike(search_pattern),
                Case.title.ilike(search_pattern),
                Case.external_reference.ilike(search_pattern)
            )
        )

    if start_date:
        query = query.filter(Case.created_at >= start_date)
    if end_date:
        query = query.filter(Case.created_at <= end_date)

    total = query.count()
    cases = query.order_by(Case.created_at.desc()).offset((page - 1) * limit).limit(limit).all()

    items = []
    for c in cases:
        inputs_cnt = db.query(WitnessInput).filter(WitnessInput.case_id == c.id).count()
        reports_cnt = db.query(FacialReport).filter(FacialReport.case_id == c.id).count()
        sketches_cnt = db.query(GeneratedSketch).filter(GeneratedSketch.case_id == c.id).count()

        last_state = "draft"
        if sketches_cnt > 0:
            last_state = "sketch"
        elif reports_cnt > 0:
            last_state = "report"
        elif inputs_cnt > 0:
            last_state = "inputs"

        items.append(
            CaseListItem(
                id=c.id,
                case_number=c.case_number,
                title=c.title,
                status=c.status,
                external_reference=c.external_reference,
                created_by=c.created_by,
                created_at=c.created_at,
                updated_at=c.updated_at,
                reports_count=reports_cnt,
                sketches_count=sketches_cnt,
                inputs_count=inputs_cnt,
                last_workflow_state=last_state
            )
        )

    return CaseListResponse(
        items=items,
        total=total,
        page=page,
        limit=limit
    )


@router.get("/{case_id}/overview")
def get_case_overview(
    case_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Case not found"
        )

    if current_user.role != "admin" and case.created_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this case"
        )

    inputs = db.query(WitnessInput).filter(WitnessInput.case_id == case.id).order_by(WitnessInput.created_at.asc()).all()
    reports = db.query(FacialReport).filter(FacialReport.case_id == case.id).order_by(FacialReport.report_version.asc()).all()
    sketches = db.query(GeneratedSketch).filter(GeneratedSketch.case_id == case.id).order_by(GeneratedSketch.sketch_version.asc()).all()

    last_state = "draft"
    if sketches:
        last_state = "sketch"
    elif reports:
        last_state = "report"
    elif inputs:
        last_state = "inputs"

    client_ip = request.client.host if request.client else None
    log_action(
        db=db,
        user_id=current_user.id,
        case_id=case.id,
        action="case_overview_view",
        details={
            "case_number": case.case_number,
            "inputs_count": len(inputs),
            "reports_count": len(reports),
            "sketches_count": len(sketches)
        },
        ip_address=client_ip
    )

    return {
        "case": CaseRead.model_validate(case),
        "inputs": [
            {
                "id": i.id,
                "input_type": i.input_type,
                "original_text": i.original_text,
                "transcription": i.transcription,
                "transcription_edited": i.transcription_edited,
                "audio_reference": i.audio_reference,
                "image_reference": i.image_reference,
                "structured_data": i.structured_data,
                "created_at": i.created_at.isoformat() if i.created_at else None
            }
            for i in inputs
        ],
        "reports": [
            {
                "id": r.id,
                "report_version": r.report_version,
                "summary": r.summary,
                "features": r.features,
                "stated_by_witness": r.stated_by_witness,
                "observed_from_image": r.observed_from_image,
                "unknown": r.unknown,
                "ambiguous": r.ambiguous,
                "created_at": r.created_at.isoformat() if r.created_at else None
            }
            for r in reports
        ],
        "sketches": [
            {
                "id": s.id,
                "sketch_version": s.sketch_version,
                "image_reference": s.image_reference,
                "generation_prompt_version": s.generation_prompt_version,
                "refinement_notes": s.refinement_notes,
                "created_at": s.created_at.isoformat() if s.created_at else None
            }
            for s in sketches
        ],
        "latest_report": {
            "id": reports[-1].id,
            "report_version": reports[-1].report_version,
            "summary": reports[-1].summary,
            "features": reports[-1].features,
            "stated_by_witness": reports[-1].stated_by_witness,
            "observed_from_image": reports[-1].observed_from_image,
            "unknown": reports[-1].unknown,
            "ambiguous": reports[-1].ambiguous,
            "created_at": reports[-1].created_at.isoformat() if reports[-1].created_at else None
        } if reports else None,
        "latest_sketch": {
            "id": sketches[-1].id,
            "sketch_version": sketches[-1].sketch_version,
            "image_reference": sketches[-1].image_reference,
            "generation_prompt_version": sketches[-1].generation_prompt_version,
            "refinement_notes": sketches[-1].refinement_notes,
            "created_at": sketches[-1].created_at.isoformat() if sketches[-1].created_at else None
        } if sketches else None,
        "last_workflow_state": last_state
    }


@router.get("/{case_id}", response_model=CaseRead)
def get_case(
    case_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Case not found"
        )

    if current_user.role != "admin" and case.created_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this case"
        )

    return case


@router.put("/{case_id}", response_model=CaseRead)
def update_case(
    case_id: str,
    payload: CaseUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Case not found"
        )

    if current_user.role != "admin" and case.created_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to update this case"
        )

    updated_fields = {}
    if payload.title is not None:
        case.title = payload.title
        updated_fields["title"] = payload.title
    if payload.status is not None:
        case.status = payload.status
        updated_fields["status"] = payload.status
    if payload.external_reference is not None:
        case.external_reference = payload.external_reference
        updated_fields["external_reference"] = payload.external_reference

    case.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(case)

    client_ip = request.client.host if request.client else None
    log_action(
        db=db,
        user_id=current_user.id,
        case_id=case.id,
        action="case_update",
        details=updated_fields,
        ip_address=client_ip
    )

    return case


@router.get("/{case_id}/audit-logs")
def get_case_audit_logs(
    case_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Case not found"
        )

    # Cross-role access control: admin or case owner only
    if current_user.role != "admin" and case.created_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Admin or case owner authorization required to view audit logs"
        )

    logs = db.query(AuditLog).filter(AuditLog.case_id == case.id).order_by(AuditLog.created_at.desc()).all()

    client_ip = request.client.host if request.client else None
    log_action(
        db=db,
        user_id=current_user.id,
        case_id=case.id,
        action="audit_logs_view",
        details={"case_number": case.case_number, "count": len(logs)},
        ip_address=client_ip
    )

    return [
        {
            "id": log.id,
            "user_id": log.user_id,
            "case_id": log.case_id,
            "action": log.action,
            "details": log.details,
            "ip_address": log.ip_address,
            "created_at": log.created_at.isoformat() if log.created_at else None
        }
        for log in logs
    ]

