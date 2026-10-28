import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import hashlib
import httpx
from app.database.session import SessionLocal
from app.models.sketch import GeneratedSketch
from app.services.storage import storage

BASE_URL = "http://127.0.0.1:8000"


def get_file_sha256(token: str) -> str:
    path = storage.get_file_path(token)
    assert path and path.is_file(), f"File for token {token} not found"
    with open(path, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()


def test_phase11():
    print("=== Step 1: Authenticate & Prepare Case with Sketch Version 1 ===")
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
        json={"title": "Refinement Verification Case", "external_reference": "REF-P11"}
    )
    assert case_res.status_code == 201
    case_id = case_res.json()["id"]

    # Witness statement mentioning jawline and hair
    httpx.post(
        f"{BASE_URL}/api/cases/{case_id}/inputs/text",
        headers=headers,
        json={"text": "Suspect had an oval face, sharp jawline, and dark hair."}
    )

    # Generate initial report
    httpx.post(f"{BASE_URL}/api/cases/{case_id}/analyze?use_fixture=true", headers=headers)

    # Generate Version 1 sketch
    v1_res = httpx.post(f"{BASE_URL}/api/cases/{case_id}/generate-sketch?use_fixture=true", headers=headers)
    assert v1_res.status_code == 201
    v1_data = v1_res.json()
    assert v1_data["sketch_version"] == 1
    v1_token = v1_data["image_reference"]
    v1_checksum_initial = get_file_sha256(v1_token)
    print(f"[PASS] Sketch Version 1 created (SHA256: {v1_checksum_initial[:16]}...)")

    print("\n=== Step 2: Refine Sketch with 'broader jawline' ===")
    refine_v2_res = httpx.post(
        f"{BASE_URL}/api/cases/{case_id}/refine-sketch?use_fixture=true",
        headers=headers,
        json={"instruction": "broader jawline with more square chin", "confirmed": False}
    )
    assert refine_v2_res.status_code == 200
    v2_resp = refine_v2_res.json()
    assert v2_resp["generated"] is True
    sketch_v2 = v2_resp["sketch"]
    assert sketch_v2["sketch_version"] == 2
    assert "broader jawline" in sketch_v2["refinement_notes"]
    print(f"[PASS] Version 2 created from refinement: {sketch_v2['refinement_notes']}")

    print("\n=== Step 3: Verify Version 1 File is Byte-Identical (Append-Only) ===")
    v1_checksum_after = get_file_sha256(v1_token)
    assert v1_checksum_initial == v1_checksum_after, "CRITICAL: Version 1 file was altered!"
    print(f"[PASS] Verified: Version 1 file is 100% byte-identical (Checksum matches: {v1_checksum_after[:16]}...)")

    print("\n=== Step 4: Instruction Introducing Unsupported Feature -> Blocked Pending Confirmation ===")
    # Statement never mentioned glasses
    refine_blocked_res = httpx.post(
        f"{BASE_URL}/api/cases/{case_id}/refine-sketch?use_fixture=true",
        headers=headers,
        json={"instruction": "add rectangular wireframe glasses", "confirmed": False}
    )
    assert refine_blocked_res.status_code == 200
    blocked_resp = refine_blocked_res.json()
    assert blocked_resp["requires_confirmation"] is True, "Expected requires_confirmation=True"
    assert blocked_resp["generated"] is False, "Generation should be blocked!"
    assert "accessories" in blocked_resp["deltas"]
    print(f"[PASS] Unsupported feature blocked: {blocked_resp['reason']}")

    # Verify no version 3 was written to DB while unconfirmed
    db = SessionLocal()
    try:
        max_v = db.query(GeneratedSketch).filter(GeneratedSketch.case_id == case_id).count()
        assert max_v == 2, f"Expected exactly 2 sketch versions in DB, found: {max_v}"
        print("[PASS] SQL confirmed: No new sketch generated while confirmation was pending")
    finally:
        db.close()

    print("\n=== Step 5: Confirm Delta -> Generates Version 3 ===")
    refine_confirmed_res = httpx.post(
        f"{BASE_URL}/api/cases/{case_id}/refine-sketch?use_fixture=true",
        headers=headers,
        json={
            "instruction": "add rectangular wireframe glasses",
            "confirmed": True,
            "deltas": blocked_resp["deltas"]
        }
    )
    assert refine_confirmed_res.status_code == 200
    confirmed_resp = refine_confirmed_res.json()
    assert confirmed_resp["generated"] is True
    sketch_v3 = confirmed_resp["sketch"]
    assert sketch_v3["sketch_version"] == 3
    assert "glasses" in sketch_v3["refinement_notes"]
    print(f"[PASS] Version 3 created upon confirmation: refinement_notes='{sketch_v3['refinement_notes']}'")

    print("\nALL PHASE 11 VERIFICATION CRITERIA PASSED!")


if __name__ == "__main__":
    test_phase11()
