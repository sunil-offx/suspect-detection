import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import io
import wave
import httpx
from app.database.session import SessionLocal
from app.models.witness_input import WitnessInput
from app.models.audit_log import AuditLog

BASE_URL = "http://127.0.0.1:8000"


def generate_wav_bytes(duration_sec: float = 0.5) -> bytes:
    """Generate a valid minimal in-memory WAV audio file."""
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(16000)
        # write silent PCM frames
        frames = b"\x00\x00" * int(16000 * duration_sec)
        wf.writeframes(frames)
    return buf.getvalue()


def test_phase7():
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
        json={"title": "Audio Witness Statement Test", "external_reference": "REF-P7"}
    )
    assert case_res.status_code == 201
    case_id = case_res.json()["id"]
    print(f"[PASS] Case created with id: {case_id}")

    print("\n=== Step 2: Test Audio Validation (415 & 413) ===")
    # 2a: Unsupported format / fake audio
    fake_audio = b"Plain text disguised as audio file, no audio header"
    res_415 = httpx.post(
        f"{BASE_URL}/api/cases/{case_id}/inputs/audio",
        headers=headers,
        files={"file": ("fake_audio.wav", fake_audio, "audio/wav")}
    )
    assert res_415.status_code == 415, f"Expected 415, got: {res_415.status_code}"
    print(f"[PASS] Fake audio returned 415 Unsupported Media Type")

    # 2b: Oversized audio (> 25MB)
    oversized_audio = b"\x00" * (26 * 1024 * 1024)
    res_413 = httpx.post(
        f"{BASE_URL}/api/cases/{case_id}/inputs/audio",
        headers=headers,
        files={"file": ("oversized.wav", oversized_audio, "audio/wav")}
    )
    assert res_413.status_code == 413, f"Expected 413, got: {res_413.status_code}"
    print(f"[PASS] 26MB audio returned 413 Payload Too Large")

    print("\n=== Step 3: Upload Valid Audio Clip ===")
    valid_wav = generate_wav_bytes(1.0)
    upload_res = httpx.post(
        f"{BASE_URL}/api/cases/{case_id}/inputs/audio",
        headers=headers,
        files={"file": ("witness_recording.wav", valid_wav, "audio/wav")}
    )
    assert upload_res.status_code == 201, f"Expected 201, got: {upload_res.status_code} {upload_res.text}"
    audio_input = upload_res.json()
    input_id = audio_input["id"]
    audio_ref = audio_input["audio_reference"]
    assert audio_ref, "Missing audio_reference token"
    print(f"[PASS] Valid audio uploaded: input_id={input_id}, ref_token={audio_ref}")

    print("\n=== Step 4: Transcribe with WHISPER_PROVIDER=none -> Expect 503 ===")
    transcribe_503 = httpx.post(
        f"{BASE_URL}/api/cases/{case_id}/transcribe",
        headers=headers
    )
    assert transcribe_503.status_code == 503, f"Expected 503, got: {transcribe_503.status_code} {transcribe_503.text}"
    assert transcribe_503.json()["code"] == "PROVIDER_UNAVAILABLE"
    print(f"[PASS] Transcribe returned 503 Service Unavailable: {transcribe_503.json()['detail']}")

    print("\n=== Step 5: Transcribe with Dev Fixture ===")
    transcribe_fix = httpx.post(
        f"{BASE_URL}/api/cases/{case_id}/transcribe?use_fixture=true",
        headers=headers
    )
    assert transcribe_fix.status_code == 200, f"Expected 200, got: {transcribe_fix.status_code} {transcribe_fix.text}"
    orig_transcription = transcribe_fix.json()["transcription"]
    assert "suspect was about" in orig_transcription.lower()
    print(f"[PASS] Transcription returned: \"{orig_transcription[:60]}...\"")

    print("\n=== Step 6: Edit Transcription via PUT ===")
    edited_text = orig_transcription + " [Correction: Witness added suspect wore dark glasses]."
    edit_res = httpx.put(
        f"{BASE_URL}/api/cases/{case_id}/inputs/{input_id}/transcription",
        headers=headers,
        json={"transcription": edited_text}
    )
    assert edit_res.status_code == 200
    updated_input = edit_res.json()
    assert updated_input["transcription"] == edited_text
    assert updated_input["transcription_edited"] is True
    print(f"[PASS] Transcription edited, marked transcription_edited=True")

    print("\n=== Step 7: SQL Verification of Original Transcription in Audit Logs ===")
    db = SessionLocal()
    try:
        # Check input in DB
        inp = db.query(WitnessInput).filter(WitnessInput.id == input_id).first()
        assert inp.transcription == edited_text
        assert inp.transcription_edited is True

        # Check audit row for transcription_edit
        edit_audit = db.query(AuditLog).filter(
            AuditLog.case_id == case_id,
            AuditLog.action == "transcription_edit"
        ).first()
        assert edit_audit is not None, "Missing audit log for transcription_edit"
        assert edit_audit.details["original_transcription"] == orig_transcription
        assert edit_audit.details["new_transcription"] == edited_text
        print("[PASS] SQL confirmed: Original transcription preserved in AuditLog details")
    finally:
        db.close()

    print("\n=== Step 8: Authenticated File Access ===")
    file_res = httpx.get(
        f"{BASE_URL}/api/files/{audio_ref}",
        headers=headers
    )
    assert file_res.status_code == 200
    assert len(file_res.content) == len(valid_wav)
    print(f"[PASS] Audio file streamable via authenticated /api/files/{audio_ref}")

    print("\nALL PHASE 7 VERIFICATION CRITERIA PASSED!")


if __name__ == "__main__":
    test_phase7()
