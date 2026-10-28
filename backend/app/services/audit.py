from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from app.models.audit_log import AuditLog
import logging

logger = logging.getLogger("crimesketch.audit")


def log_action(
    db: Session,
    user_id: Optional[str],
    case_id: Optional[str],
    action: str,
    details: Optional[Dict[str, Any]] = None,
    ip_address: Optional[str] = None
) -> AuditLog:
    log_entry = AuditLog(
        user_id=user_id,
        case_id=case_id,
        action=action,
        details=details or {},
        ip_address=ip_address
    )
    db.add(log_entry)
    db.commit()
    db.refresh(log_entry)

    logger.info(
        f"AUDIT: action={action} user_id={user_id} case_id={case_id} ip={ip_address}"
    )
    return log_entry
