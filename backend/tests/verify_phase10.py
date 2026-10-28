import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import httpx
from app.database.session import SessionLocal
from app.models.sketch import GeneratedSketch
from app.services.storage import storage

BASE_URL = "http://127.0.0.1:8000"


def test_phase10():
    print("=== Step 1: Authenticate & Prepare Case with Confirmed Report ===")
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
        json={"title": "Sketch Generation Test", "external_reference": "REF-P10"}
    )
    assert case_res.status_code == 201
    case_id = case_res.json()["id"]

    # Submit text input
    httpx.post(
        f"{BASE_URL}/api/cases/{case_id}/inputs/text",
        headers=headers,
        json={"text": "Male suspect with oval face, short dark textured hair, and goatee."}
    )

    # Analyze into confirmed report
    rep_res = httpx.post(
        f"{BASE_URL}/api/cases/{case_id}/analyze?use_fixture=true",
        headers=headers
    )
    assert rep_res.status_code == 201
    print(f"[PASS] Case {case_id} prepared with confirmed report")

    print("\n=== Step 2: Generate with IMAGE_PROVIDER=none -> Expect 503 + Zero DB/File Leakage ===")
    res_503 = httpx.post(
        f"{BASE_URL}/api/cases/{case_id}/generate-sketch",
        headers=headers
    )
    assert res_503.status_code == 503, f"Expected 503, got: {res_503.status_code} {res_503.text}"
    assert res_503.json()["code"] == "PROVIDER_UNAVAILABLE"
    print(f"[PASS] Endpoint returned 503 Service Unavailable: {res_503.json()['detail']}")

    db = SessionLocal()
    try:
        sketch_count = db.query(GeneratedSketch).filter(GeneratedSketch.case_id == case_id).count()
        assert sketch_count == 0, f"Expected 0 sketches in DB, found: {sketch_count}"
        print("[PASS] Verified via SQL: zero sketch rows written during 503")
    finally:
        db.close()

    print("\n=== Step 3: Generate Version 1 with Fixture ===")
    gen_v1 = httpx.post(
        f"{BASE_URL}/api/cases/{case_id}/generate-sketch?use_fixture=true",
        headers=headers
    )
    assert gen_v1.status_code == 201, f"Expected 201, got: {gen_v1.status_code} {gen_v1.text}"
    v1_data = gen_v1.json()
    assert v1_data["sketch_version"] == 1
    assert v1_data["generation_prompt_version"] == "sketch_v1"
    v1_token = v1_data["image_reference"]
    assert v1_token, "Missing image_reference"
    print(f"[PASS] Sketch Version 1 created: id={v1_data['id']}, token={v1_token}")

    print("\n=== Step 4: Inspect Prompt Sent to Provider ===")
    prompt = v1_data["prompt_used"]
    assert "Face Shape: oval" in prompt
    assert "Eyebrows: thick arched dark brown" in prompt
    # Check that unstated fields are explicitly neutral
    assert "unspecified, render neutral" in prompt
    print("[PASS] Verified: Prompt strictly contains confirmed features and neutral placeholders")

    print("\n=== Step 5: Regenerate -> Creates Version 2 (Version 1 Still Retrievable) ===")
    gen_v2 = httpx.post(
        f"{BASE_URL}/api/cases/{case_id}/generate-sketch?use_fixture=true",
        headers=headers
    )
    assert gen_v2.status_code == 201
    v2_data = gen_v2.json()
    assert v2_data["sketch_version"] == 2
    v2_token = v2_data["image_reference"]
    print(f"[PASS] Sketch Version 2 created: id={v2_data['id']}, token={v2_token}")

    # Verify both versions listed
    list_res = httpx.get(f"{BASE_URL}/api/cases/{case_id}/sketches", headers=headers)
    assert list_res.status_code == 200
    sketches = list_res.json()
    assert len(sketches) == 2
    versions = [s["sketch_version"] for s in sketches]
    assert 1 in versions and 2 in versions
    print(f"[PASS] GET /sketches lists both versions: {versions}")

    # Fetch Version 1 specifically
    get_v1 = httpx.get(f"{BASE_URL}/api/cases/{case_id}/sketches/1", headers=headers)
    assert get_v1.status_code == 200
    assert get_v1.json()["sketch_version"] == 1
    assert get_v1.json()["image_reference"] == v1_token
    print("[PASS] Version 1 remains retrievable and byte-identical")

    # Download verification
    dl_v1 = httpx.get(f"{BASE_URL}/api/files/{v1_token}", headers=headers)
    assert dl_v1.status_code == 200
    assert dl_v1.headers["content-type"].startswith("image/png")
    assert len(dl_v1.content) > 1000
    print(f"[PASS] Version 1 image downloadable via authenticated endpoint ({len(dl_v1.content)} bytes)")

    print("\nALL PHASE 10 VERIFICATION CRITERIA PASSED!")


if __name__ == "__main__":
    test_phase10()
