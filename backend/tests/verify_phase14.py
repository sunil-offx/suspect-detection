import os
import re
import sys
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

# Add backend to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app
from app.database.session import SessionLocal
from app.models.case import Case
from app.models.audit_log import AuditLog
from app.models.user import User
from app.security.rate_limit import login_limiter
from scripts.purge_old_cases import purge_old_cases

client = TestClient(app)

def run_phase14_verification():
    print("=== Phase 14 Verification Gate: Audit, Security & Privacy Hardening ===")
    db: Session = SessionLocal()
    try:
        # Step 0: Login admin
        admin_login = client.post("/api/auth/login", json={"email": "admin@crimesketch.com", "password": "AdminSecurePassword123!"})
        assert admin_login.status_code == 200
        admin_token = admin_login.json()["access_token"]
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        admin_id = admin_login.json()["user"]["id"]
        print("[PASS] Admin logged in successfully")

        # GATE 1: Audit rows for view/edit/download/generate exist for one full workflow
        # 1. Create case
        c_res = client.post("/api/cases", json={"title": "Hardening Audit Workflow Case"}, headers=admin_headers)
        assert c_res.status_code == 201
        case_id = c_res.json()["id"]

        # 2. Input text
        inp_res = client.post(f"/api/cases/{case_id}/inputs/text", json={"text": "Audit test suspect text."}, headers=admin_headers)
        assert inp_res.status_code == 201

        # 3. Analyze report
        rep_res = client.post(f"/api/cases/{case_id}/analyze?use_fixture=true", headers=admin_headers)
        assert rep_res.status_code == 201

        # 4. Edit report (PUT)
        upd_rep = client.put(f"/api/cases/{case_id}/report", json={"summary": "Updated audit summary"}, headers=admin_headers)
        assert upd_rep.status_code == 200

        # 5. Generate sketch
        sk_res = client.post(f"/api/cases/{case_id}/generate-sketch?use_fixture=true", headers=admin_headers)
        assert sk_res.status_code == 201
        img_token = sk_res.json()["image_reference"]

        # 6. Read / Download file
        file_res = client.get(f"/api/files/{img_token}", headers=admin_headers)
        assert file_res.status_code == 200

        # 7. View case overview
        view_res = client.get(f"/api/cases/{case_id}/overview", headers=admin_headers)
        assert view_res.status_code == 200

        # Verify audit logs in database
        case_actions = [a[0] for a in db.query(AuditLog.action).filter(AuditLog.case_id == case_id).all()]
        expected_actions = [
            "case_create",
            "input_text_create",
            "report_analyze",
            "report_update",
            "sketch_generate",
            "file_read",
            "case_overview_view"
        ]
        for act in expected_actions:
            assert act in case_actions, f"Expected action '{act}' not found in audit logs for case {case_id}"
        print(f"[PASS] Gate 1: Full workflow audit verified (Actions present: {set(case_actions)})")

        # GATE 2: No sensitive credentials in log files
        log_file = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "logs", "crimesketch.log"))
        if os.path.exists(log_file):
            with open(log_file, "r", encoding="utf-8") as f:
                log_content = f.read()
            # Ensure no raw passwords or raw bearer tokens
            assert "AdminSecurePassword123!" not in log_content, "Plaintext password leaked in log file!"
            assert not re.search(r'Bearer\s+[A-Za-z0-9_\-\.]{25,}', log_content), "Unredacted Bearer token leaked in log file!"
            print("[PASS] Gate 2: Log file inspected — 0 plaintext passwords or unredacted bearer tokens found")

        # GATE 3: Private storage is NOT web-accessible directly
        storage_curl = client.get("/storage/some_secret_image.png")
        assert storage_curl.status_code == 404, f"Direct storage access should return 404, got {storage_curl.status_code}"
        print("[PASS] Gate 3: Direct web access to /storage/... returns 404 Not Found")

        # GATE 4: Cross-role audit-log access → 403 for non-admin
        # Register an investigator user
        inv_email = f"investigator_{int(datetime.now().timestamp())}@crimesketch.com"
        reg_res = client.post("/api/auth/register", json={"email": inv_email, "password": "InvestigatorPassword123!", "role": "investigator"}, headers=admin_headers)
        assert reg_res.status_code == 201

        # Login investigator
        inv_login = client.post("/api/auth/login", json={"email": inv_email, "password": "InvestigatorPassword123!"})
        assert inv_login.status_code == 200
        inv_token = inv_login.json()["access_token"]
        inv_headers = {"Authorization": f"Bearer {inv_token}"}

        # Attempt to access audit logs of admin's case with investigator account
        inv_audit_res = client.get(f"/api/cases/{case_id}/audit-logs", headers=inv_headers)
        assert inv_audit_res.status_code == 403, f"Cross-role access should be 403, got {inv_audit_res.status_code}"

        # Admin access to audit logs must be 200
        admin_audit_res = client.get(f"/api/cases/{case_id}/audit-logs", headers=admin_headers)
        assert admin_audit_res.status_code == 200
        assert len(admin_audit_res.json()) >= 6
        print("[PASS] Gate 4: Cross-role audit-log access strictly blocked with HTTP 403; Admin access authorized")

        # GATE 5: Rate limit: 6th bad login in 60s → 429
        # Reset limiter for clean test
        test_ip = "192.168.1.100"
        test_email = "victim@crimesketch.com"
        test_headers = {"X-Forwarded-For": test_ip}
        login_limiter.reset(f"{test_ip}:{test_email}")
        login_limiter.reset(test_ip)

        for attempt in range(1, 6):
            bad_res = client.post("/api/auth/login", json={"email": test_email, "password": f"WrongPass{attempt}!"}, headers=test_headers)
            assert bad_res.status_code == 401, f"Attempt {attempt} should return 401, got {bad_res.status_code}"

        # 6th attempt must return 429 Too Many Requests
        rate_limited_res = client.post("/api/auth/login", json={"email": test_email, "password": "WrongPass6!"}, headers=test_headers)
        assert rate_limited_res.status_code == 429, f"6th attempt should return 429, got {rate_limited_res.status_code}"
        assert "Too many failed login attempts" in rate_limited_res.json()["detail"]
        print("[PASS] Gate 5: Rate limiter successfully triggered HTTP 429 on 6th bad login attempt in 60s")

        # GATE 6: Retention purge script dry-run
        purged, files = purge_old_cases(retention_days=90, dry_run=True)
        print(f"[PASS] Gate 6: Retention purge script executed successfully (Simulated: {purged} cases, {files} files)")

        print("\n=== ALL PHASE 14 VERIFICATION GATES PASSED ===")
    finally:
        db.close()

if __name__ == "__main__":
    run_phase14_verification()
