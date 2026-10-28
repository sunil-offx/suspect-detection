import io
import sys
import httpx
from PIL import Image

BASE_URL = "http://127.0.0.1:8000"

def test_phase3():
    print("=== 1. Testing Login & JWT ===")
    login_resp = httpx.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@crimesketch.com",
        "password": "AdminSecurePassword123!"
    })
    assert login_resp.status_code == 200, f"Login failed: {login_resp.status_code} {login_resp.text}"
    login_data = login_resp.json()
    token = login_data["access_token"]
    assert token, "No token returned in login response"
    print("[PASS] Login returned valid JWT")

    # /api/auth/me with valid token
    me_resp = httpx.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_resp.status_code == 200, f"/me failed with valid token: {me_resp.status_code}"
    assert me_resp.json()["email"] == "admin@crimesketch.com"
    print("[PASS] /api/auth/me succeeded with valid token")

    # /api/auth/me without token -> 401
    no_auth_resp = httpx.get(f"{BASE_URL}/api/auth/me")
    assert no_auth_resp.status_code == 401, f"Expected 401 without token, got: {no_auth_resp.status_code}"
    print("[PASS] /api/auth/me without token returned 401")

    print("\n=== 2. Testing Tampered Token ===")
    tampered_token = token[:-5] + "xyz12"
    tampered_resp = httpx.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {tampered_token}"})
    assert tampered_resp.status_code == 401, f"Expected 401 for tampered token, got: {tampered_resp.status_code}"
    print("[PASS] Tampered token returned 401")

    print("\n=== 3. Testing File Upload Validation ===")
    # 3a. Valid image upload
    img_byte_arr = io.BytesIO()
    valid_img = Image.new("RGB", (64, 64), color="red")
    valid_img.save(img_byte_arr, format="PNG")
    valid_png_bytes = img_byte_arr.getvalue()

    upload_valid_resp = httpx.post(
        f"{BASE_URL}/api/test/upload-image",
        files={"file": ("test.png", valid_png_bytes, "image/png")}
    )
    assert upload_valid_resp.status_code == 200, f"Valid image upload failed: {upload_valid_resp.status_code}"
    print("[PASS] Valid image upload accepted and stored with token")

    # 3b. Wrong MIME / corrupt file renamed as .jpg -> 415
    fake_img_bytes = b"This is not a real image at all, just plain text disguised as jpg."
    upload_wrong_mime = httpx.post(
        f"{BASE_URL}/api/test/upload-image",
        files={"file": ("fake.jpg", fake_img_bytes, "image/jpeg")}
    )
    assert upload_wrong_mime.status_code == 415, f"Expected 415 for wrong MIME, got: {upload_wrong_mime.status_code}"
    print("[PASS] Fake image disguised as jpg returned 415 (MIME sniffed)")

    # 3c. Oversized file -> 413 (> 25MB)
    # 26MB of zeros
    oversized_bytes = b"\x00" * (26 * 1024 * 1024)
    upload_oversized = httpx.post(
        f"{BASE_URL}/api/test/upload-image",
        files={"file": ("oversized.png", oversized_bytes, "image/png")}
    )
    assert upload_oversized.status_code == 413, f"Expected 413 for oversized file, got: {upload_oversized.status_code}"
    print("[PASS] 26MB oversized file returned 413 (Payload Too Large)")

    print("\nALL PHASE 3 HTTP CHECKS PASSED!")

if __name__ == "__main__":
    test_phase3()
