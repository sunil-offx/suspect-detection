import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import httpx
import re
from app.database.session import SessionLocal
from app.models.audit_log import AuditLog

BASE_URL = "http://127.0.0.1:8000"

def test_phase4():
    print("=== Step 1: Authenticate Admin & Investigator Users ===")
    # 1. Admin login
    admin_login = httpx.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@crimesketch.com",
        "password": "AdminSecurePassword123!"
    })
    assert admin_login.status_code == 200, f"Admin login failed: {admin_login.text}"
    admin_token = admin_login.json()["access_token"]
    print("[PASS] Admin logged in")

    # Register Investigator 1 (User 2) via Admin
    inv1_email = "investigator1@crimesketch.com"
    httpx.post(
        f"{BASE_URL}/api/auth/register",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"email": inv1_email, "password": "Password123!", "role": "investigator"}
    )
    # Login Investigator 1
    inv1_login = httpx.post(f"{BASE_URL}/api/auth/login", json={
        "email": inv1_email,
        "password": "Password123!"
    })
    assert inv1_login.status_code == 200
    inv1_token = inv1_login.json()["access_token"]
    inv1_id = inv1_login.json()["user"]["id"]
    print(f"[PASS] Investigator 1 authenticated (id: {inv1_id})")

    # Register Investigator 2 (User 3) via Admin
    inv2_email = "investigator2@crimesketch.com"
    httpx.post(
        f"{BASE_URL}/api/auth/register",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"email": inv2_email, "password": "Password123!", "role": "investigator"}
    )
    # Login Investigator 2
    inv2_login = httpx.post(f"{BASE_URL}/api/auth/login", json={
        "email": inv2_email,
        "password": "Password123!"
    })
    assert inv2_login.status_code == 200
    inv2_token = inv2_login.json()["access_token"]
    inv2_id = inv2_login.json()["user"]["id"]
    print(f"[PASS] Investigator 2 authenticated (id: {inv2_id})")

    print("\n=== Step 2: Create Case as Investigator 1 ===")
    create_resp = httpx.post(
        f"{BASE_URL}/api/cases",
        headers={"Authorization": f"Bearer {inv1_token}"},
        json={"title": "Armed Robbery on 5th Avenue", "external_reference": "RMS-99120"}
    )
    assert create_resp.status_code == 201, f"Expected 201, got {create_resp.status_code}: {create_resp.text}"
    case_data = create_resp.json()
    case_id = case_data["id"]
    case_number = case_data["case_number"]
    assert re.match(r"^CS-\d{8}-[A-Z0-9]{4}$", case_number), f"Invalid case_number format: {case_number}"
    assert "created_at" in case_data and case_data["created_at"], "Missing created_at"
    print(f"[PASS] Case created (201): case_number={case_number}, id={case_id}")

    print("\n=== Step 3: List Cases for Investigator 1 ===")
    list_resp = httpx.get(
        f"{BASE_URL}/api/cases",
        headers={"Authorization": f"Bearer {inv1_token}"}
    )
    assert list_resp.status_code == 200
    items = list_resp.json()["items"]
    found = any(c["id"] == case_id for c in items)
    assert found, "Created case not found in Investigator 1's list"
    print(f"[PASS] List reflects the new case (total items: {list_resp.json()['total']})")

    print("\n=== Step 4: Cross-User Authorization (Investigator 2 GETs Investigator 1's case) ===")
    cross_resp = httpx.get(
        f"{BASE_URL}/api/cases/{case_id}",
        headers={"Authorization": f"Bearer {inv2_token}"}
    )
    assert cross_resp.status_code == 403, f"Expected 403 Forbidden, got: {cross_resp.status_code}"
    print(f"[PASS] Cross-user access blocked with 403 Forbidden")

    print("\n=== Step 5: Update Case as Investigator 1 ===")
    update_resp = httpx.put(
        f"{BASE_URL}/api/cases/{case_id}",
        headers={"Authorization": f"Bearer {inv1_token}"},
        json={"status": "in_progress", "title": "Armed Robbery on 5th Avenue - Priority"}
    )
    assert update_resp.status_code == 200
    updated_data = update_resp.json()
    assert updated_data["status"] == "in_progress"
    print(f"[PASS] Case update succeeded with status='in_progress'")

    print("\n=== Step 6: Case Stats Endpoint ===")
    stats_resp = httpx.get(
        f"{BASE_URL}/api/cases/stats",
        headers={"Authorization": f"Bearer {inv1_token}"}
    )
    assert stats_resp.status_code == 200
    stats = stats_resp.json()
    assert stats["total"] >= 1
    assert stats["in_progress"] >= 1
    assert stats["recent"] >= 1
    print(f"[PASS] Stats verified: {stats}")

    print("\n=== Step 7: Verify Audit Rows for Mutation ===")
    db = SessionLocal()
    try:
        create_audit = db.query(AuditLog).filter(
            AuditLog.case_id == case_id,
            AuditLog.action == "case_create"
        ).first()
        assert create_audit is not None, "Missing audit log row for case_create"

        update_audit = db.query(AuditLog).filter(
            AuditLog.case_id == case_id,
            AuditLog.action == "case_update"
        ).first()
        assert update_audit is not None, "Missing audit log row for case_update"
        print(f"[PASS] Audit rows confirmed in DB: case_create and case_update exist for case {case_id}")
    finally:
        db.close()

    print("\nALL PHASE 4 CRITERIA PASSED!")

if __name__ == "__main__":
    test_phase4()
