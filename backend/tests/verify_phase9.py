import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import httpx
from app.database.session import SessionLocal
from app.models.witness_input import WitnessInput
from app.models.facial_report import FacialReport

BASE_URL = "http://127.0.0.1:8000"

def test_phase9():
    print("=== Step 1: Authenticate & Create Case ===")
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
        json={"title": "Report Document View Verification", "external_reference": "REF-P9"}
    )
    assert case_res.status_code == 201
    case_id = case_res.json()["id"]

    # Submit original witness statement
    original_witness_stmt = "Witness John Doe: Suspect was male, roughly 30 years old, sharp angular jawline, dark hazel eyes, short goatee."
    inp_res = httpx.post(
        f"{BASE_URL}/api/cases/{case_id}/inputs/text",
        headers=headers,
        json={"text": original_witness_stmt}
    )
    assert inp_res.status_code == 201
    print(f"[PASS] Case {case_id} initialized with witness statement")

    print("\n=== Step 2: Generate Report with Fixture Data ===")
    gen_res = httpx.post(
        f"{BASE_URL}/api/cases/{case_id}/analyze?use_fixture=true",
        headers=headers
    )
    assert gen_res.status_code == 201
    report1 = gen_res.json()
    assert report1["report_version"] == 1
    assert len(report1["stated_by_witness"]) > 0
    assert len(report1["unknown"]) > 0
    assert len(report1["ambiguous"]) > 0
    print("[PASS] All confidence categories populated with fixture data")

    print("\n=== Step 3: Test Edit + Save via PUT & Verify Reload ===")
    put_res = httpx.put(
        f"{BASE_URL}/api/cases/{case_id}/report",
        headers=headers,
        json={
            "summary": "Verified updated summary: Suspect observed fleeing westward in dark jacket.",
            "features": {
                **report1["features"],
                "jawline": "prominent squarish jawline with cleft chin"
            }
        }
    )
    assert put_res.status_code == 200
    report2 = put_res.json()
    assert report2["report_version"] == 2
    assert "cleft chin" in report2["features"]["jawline"]
    print(f"[PASS] Report edited via PUT and bumped to version {report2['report_version']}")

    # Reload check
    get_res = httpx.get(f"{BASE_URL}/api/cases/{case_id}/report", headers=headers)
    assert get_res.status_code == 200
    reloaded = get_res.json()
    assert reloaded["report_version"] == 2
    assert "cleft chin" in reloaded["features"]["jawline"]
    assert original_witness_stmt in reloaded["original_witness_statements"]
    print("[PASS] Verified on reload: updated values persist, original statement attached")

    print("\n=== Step 4: Regenerate Report & Verify Original Statement Untouched ===")
    regen_res = httpx.post(
        f"{BASE_URL}/api/cases/{case_id}/analyze?use_fixture=true",
        headers=headers
    )
    assert regen_res.status_code == 201
    re_rep = regen_res.json()
    assert original_witness_stmt in re_rep["original_witness_statements"]

    db = SessionLocal()
    try:
        inp_db = db.query(WitnessInput).filter(WitnessInput.case_id == case_id).first()
        assert inp_db.original_text == original_witness_stmt, "Original statement was altered!"
        print("[PASS] SQL verified: Original witness statement remains 100% immutable across regenerate")
    finally:
        db.close()

    print("\nALL PHASE 9 VERIFICATION CRITERIA PASSED!")

if __name__ == "__main__":
    test_phase9()
