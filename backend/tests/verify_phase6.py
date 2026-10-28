import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import httpx
from app.database.session import SessionLocal
from app.models.case import Case
from app.models.witness_input import WitnessInput
from app.models.facial_report import FacialReport
from app.models.audit_log import AuditLog

BASE_URL = "http://127.0.0.1:8000"

def test_phase6():
    print("=== Step 1: Authenticate Investigator & Create Case ===")
    login = httpx.post(f"{BASE_URL}/api/auth/login", json={
        "email": "investigator1@crimesketch.com",
        "password": "Password123!"
    })
    assert login.status_code == 200
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    case_res = httpx.post(
        f"{BASE_URL}/api/cases",
        headers=headers,
        json={"title": "Armed Robbery Phase 6 Test", "external_reference": "REF-P6"}
    )
    assert case_res.status_code == 201
    case_id = case_res.json()["id"]
    print(f"[PASS] Case created with id: {case_id}")

    print("\n=== Step 2: Submit Text Input ===")
    initial_text = "The suspect was a male in his early 30s with an oval face, sharp jawline, and a neat goatee. He had dark wavy hair."
    input_res = httpx.post(
        f"{BASE_URL}/api/cases/{case_id}/inputs/text",
        headers=headers,
        json={"text": initial_text, "structured_fields": {"estimated_age": "30-35"}}
    )
    assert input_res.status_code == 201
    input_data = input_res.json()
    assert input_data["original_text"] == initial_text
    print(f"[PASS] Text input submitted: {input_data['id']}")

    print("\n=== Step 3: Analyze with LLM_PROVIDER=none -> Expect 503 + No Report Row ===")
    analyze_503 = httpx.post(
        f"{BASE_URL}/api/cases/{case_id}/analyze",
        headers=headers
    )
    assert analyze_503.status_code == 503, f"Expected 503, got: {analyze_503.status_code} {analyze_503.text}"
    assert analyze_503.json()["code"] == "PROVIDER_UNAVAILABLE"
    print(f"[PASS] Endpoint returned 503 Service Unavailable: {analyze_503.json()['detail']}")

    db = SessionLocal()
    try:
        report_count = db.query(FacialReport).filter(FacialReport.case_id == case_id).count()
        assert report_count == 0, f"Expected 0 reports in DB after 503, found: {report_count}"
        print("[PASS] Verified via SQL: zero report rows written during 503")
    finally:
        db.close()

    print("\n=== Step 4: Analyze with Dev Fixture (DEV_FIXTURES=1) ===")
    analyze_fix = httpx.post(
        f"{BASE_URL}/api/cases/{case_id}/analyze?use_fixture=true",
        headers=headers
    )
    assert analyze_fix.status_code == 201, f"Expected 201 with dev fixture, got: {analyze_fix.status_code} {analyze_fix.text}"
    report_data = analyze_fix.json()
    report_id = report_data["id"]
    assert report_data["report_version"] == 1
    assert report_data["features"]["face_shape"] == "oval"
    assert report_data["features"]["accessories"] is None, "Expected null for unstated accessories"
    assert len(report_data["stated_by_witness"]) > 0
    assert len(report_data["unknown"]) > 0
    print(f"[PASS] Fixture report created: version={report_data['report_version']}, id={report_id}")

    print("\n=== Step 5: Read Report via GET /api/cases/{case_id}/report ===")
    get_rep = httpx.get(
        f"{BASE_URL}/api/cases/{case_id}/report",
        headers=headers
    )
    assert get_rep.status_code == 200
    assert get_rep.json()["id"] == report_id
    assert initial_text in get_rep.json()["original_witness_statements"]
    print("[PASS] GET /report succeeded and includes original witness statements")

    print("\n=== Step 6: Update Report via PUT -> Bumps report_version to 2 ===")
    put_rep = httpx.put(
        f"{BASE_URL}/api/cases/{case_id}/report",
        headers=headers,
        json={
            "summary": "Updated summary after investigator review: Suspect has very prominent chin.",
            "features": {
                **report_data["features"],
                "jawline": "extremely sharp angular with pronounced squared chin"
            }
        }
    )
    assert put_rep.status_code == 200
    v2_data = put_rep.json()
    assert v2_data["report_version"] == 2
    assert "extremely sharp" in v2_data["features"]["jawline"]
    print(f"[PASS] Report bumped to version {v2_data['report_version']}")

    print("\n=== Step 7: SQL Verification of Immutability and Audit Logging ===")
    db = SessionLocal()
    try:
        # Check WitnessInput original_text unchanged
        inp = db.query(WitnessInput).filter(WitnessInput.case_id == case_id).first()
        assert inp.original_text == initial_text, "CRITICAL: original_text was modified!"
        print(f"[PASS] SQL confirmed: original witness statement is strictly byte-identical and immutable")

        # Check version history in DB
        reports = db.query(FacialReport).filter(FacialReport.case_id == case_id).order_by(FacialReport.report_version.asc()).all()
        assert len(reports) == 2, f"Expected 2 report version rows, got {len(reports)}"
        assert reports[0].report_version == 1
        assert reports[1].report_version == 2
        print("[PASS] SQL confirmed: both Version 1 and Version 2 are preserved in database")

        # Check audit rows
        audit_actions = [a.action for a in db.query(AuditLog).filter(AuditLog.case_id == case_id).all()]
        assert "input_text_create" in audit_actions
        assert "report_analyze" in audit_actions
        assert "report_update" in audit_actions
        print(f"[PASS] SQL confirmed: audit actions recorded: {audit_actions}")
    finally:
        db.close()

    print("\nALL PHASE 6 VERIFICATION CRITERIA PASSED!")

if __name__ == "__main__":
    test_phase6()
