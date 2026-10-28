import sys
import argparse
from datetime import datetime, timezone, timedelta
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.database.session import SessionLocal
from app.models.case import Case
from app.models.witness_input import WitnessInput
from app.models.sketch import GeneratedSketch
from app.models.audit_log import AuditLog
from app.services.storage import storage
from app.services.audit import log_action
from app.core.config import settings


def purge_old_cases(retention_days: int = 90, dry_run: bool = False):
    db = SessionLocal()
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days)
        print(f"[*] Running case retention purge (Retention: {retention_days} days, Cutoff: {cutoff.isoformat()})")

        # Find eligible cases: status in ('closed', 'archived') and updated_at <= cutoff
        candidates = db.query(Case).filter(
            Case.status.in_(["closed", "archived"]),
            Case.updated_at <= cutoff
        ).all()

        print(f"[*] Found {len(candidates)} closed cases eligible for purge.")

        purged_count = 0
        freed_files = 0

        for case in candidates:
            print(f"  -> Processing Case {case.case_number} (ID: {case.id})")

            # Collect storage references
            inputs = db.query(WitnessInput).filter(WitnessInput.case_id == case.id).all()
            sketches = db.query(GeneratedSketch).filter(GeneratedSketch.case_id == case.id).all()

            storage_tokens = []
            for inp in inputs:
                if inp.audio_reference:
                    storage_tokens.append(inp.audio_reference)
                if inp.image_reference:
                    storage_tokens.append(inp.image_reference)
            for sk in sketches:
                if sk.image_reference:
                    storage_tokens.append(sk.image_reference)

            if not dry_run:
                # Delete physical files from private storage
                for token in storage_tokens:
                    if storage.delete_file(token):
                        freed_files += 1

                # Log purge action before deletion
                log_action(
                    db=db,
                    user_id=None,
                    case_id=case.id,
                    action="case_purged",
                    details={
                        "case_number": case.case_number,
                        "retention_days": retention_days,
                        "files_purged": len(storage_tokens)
                    }
                )

                # Delete case record (cascades to inputs, reports, sketches)
                db.delete(case)
                db.commit()
                purged_count += 1
            else:
                freed_files += len(storage_tokens)
                purged_count += 1

        status_str = "DRY RUN COMPLETE" if dry_run else "PURGE COMPLETE"
        print(f"[+] {status_str}: {purged_count} cases purged, {freed_files} physical storage files deleted.")
        return purged_count, freed_files
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Purge old closed cases beyond retention window")
    parser.add_argument("--days", type=int, default=90, help="Retention period in days (default: 90)")
    parser.add_argument("--dry-run", action="store_true", help="Simulate purge without deleting")
    args = parser.parse_args()

    purge_old_cases(retention_days=args.days, dry_run=args.dry_run)
