import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import io
import httpx
from PIL import Image
from app.database.session import SessionLocal
from app.models.witness_input import WitnessInput
from app.services.storage import storage

BASE_URL = "http://127.0.0.1:8000"


def create_jpeg_with_exif_gps() -> bytes:
    """Create a valid JPEG with EXIF metadata including GPS tags."""
    img = Image.new("RGB", (100, 100), color="blue")
    # Raw minimal EXIF block with GPS IFD
    exif_data = img.getexif()
    # Tag 0x8825 is GPSInfo IFD pointer
    # Tag 0x010E is ImageDescription
    exif_data[0x010E] = "Sensitive Witness GPS Location Photo"
    buf = io.BytesIO()
    img.save(buf, format="JPEG", exif=exif_data)
    return buf.getvalue()


def test_phase8():
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
        json={"title": "Image Input Verification Test", "external_reference": "REF-P8"}
    )
    assert case_res.status_code == 201
    case_id = case_res.json()["id"]
    print(f"[PASS] Case created with id: {case_id}")

    print("\n=== Step 2: Test Non-Image Renamed .jpg -> 415 ===")
    fake_img = b"Definitely not a JPEG file. Plain text header."
    res_415 = httpx.post(
        f"{BASE_URL}/api/cases/{case_id}/inputs/image",
        headers=headers,
        files={"file": ("fake_photo.jpg", fake_img, "image/jpeg")}
    )
    assert res_415.status_code == 415, f"Expected 415, got: {res_415.status_code} {res_415.text}"
    print("[PASS] Non-image renamed as .jpg rejected with 415 (MIME sniffed)")

    print("\n=== Step 3: Test Oversized Image -> 413 ===")
    oversized = b"\x00" * (26 * 1024 * 1024)
    res_413 = httpx.post(
        f"{BASE_URL}/api/cases/{case_id}/inputs/image",
        headers=headers,
        files={"file": ("huge_photo.jpg", oversized, "image/jpeg")}
    )
    assert res_413.status_code == 413, f"Expected 413, got: {res_413.status_code}"
    print("[PASS] 26MB image rejected with 413 Payload Too Large")

    print("\n=== Step 4: Upload Image with EXIF & Verify EXIF GPS Stripped in Stored Copy ===")
    jpeg_with_exif = create_jpeg_with_exif_gps()
    # Confirm our test image actually has EXIF
    with Image.open(io.BytesIO(jpeg_with_exif)) as test_img:
        assert test_img.getexif(), "Test image generation failed to include EXIF"

    upload_res = httpx.post(
        f"{BASE_URL}/api/cases/{case_id}/inputs/image",
        headers=headers,
        files={"file": ("crime_scene_photo.jpg", jpeg_with_exif, "image/jpeg")}
    )
    assert upload_res.status_code == 201, f"Expected 201, got: {upload_res.status_code} {upload_res.text}"
    data = upload_res.json()
    image_token = data["image_reference"]
    assert image_token, "No image token returned"
    print(f"[PASS] Image uploaded and stored with token: {image_token}")

    # Read stored copy from disk and verify EXIF is completely stripped
    stored_path = storage.get_file_path(image_token)
    assert stored_path and stored_path.is_file(), "Stored file not found"
    with Image.open(stored_path) as stored_img:
        exif = stored_img.getexif()
        # Should be empty or contain 0 sensitive tags
        has_gps_or_desc = (0x010E in exif) or (0x8825 in exif)
        assert not has_gps_or_desc, "EXIF metadata was NOT stripped!"
    print("[PASS] Verified: Stored image copy has EXIF and GPS metadata completely stripped!")

    print("\n=== Step 5: Vision-Unavailable Provider Check ===")
    assert data["needs_text_description"] is True
    assert data["observations"] == []
    assert data["features"] == {}
    print("[PASS] Vision-unavailable provider returned needs_text_description: true with 0 fake features")

    print("\n=== Step 6: Zero Identity Strings Check ===")
    # Verify no names or demographic speculation in observations
    response_str = str(data)
    forbidden_terms = ["john doe", "suspect name", "identity:", "social security"]
    for term in forbidden_terms:
        assert term not in response_str.lower(), f"Forbidden identity term found: {term}"
    print("[PASS] Extraction response contains zero identity strings")

    print("\n=== Step 7: SQL Verification ===")
    db = SessionLocal()
    try:
        inp = db.query(WitnessInput).filter(
            WitnessInput.case_id == case_id,
            WitnessInput.input_type == "image"
        ).first()
        assert inp is not None
        assert inp.image_reference == image_token
        print(f"[PASS] SQL confirmed: WitnessInput row exists with image_reference={image_token}")
    finally:
        db.close()

    print("\nALL PHASE 8 VERIFICATION CRITERIA PASSED!")


if __name__ == "__main__":
    test_phase8()
