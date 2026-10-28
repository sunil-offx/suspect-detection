# CrimeSketch AI — Interactive Scripted Demonstration Walkthrough

This guide provides a scripted walkthrough for evaluating CrimeSketch AI, covering the complete end-to-end happy path and testing explicit failure modes across each input modality.

---

## Prerequisites
Ensure both backend and frontend servers are running:
- **Backend API**: `http://127.0.0.1:8000` (`http://127.0.0.1:8000/health` returns `{"status":"ok"}`)
- **Frontend Web UI**: `http://127.0.0.1:5173`
- **Default Admin Account**: `admin@crimesketch.com` / `AdminSecurePassword123!`

---

## Part 1: Happy Path Walkthrough (Step-by-Step)

### Step 1: Welcome & Logo Reveal
1. Open `http://127.0.0.1:5173/` in your web browser.
2. Observe the animated logo reveal (< 2s) and system badges.
3. Click **"Get Started"** or **"Enter Dashboard"**.
4. Notice that on subsequent visits, the splash animation is skipped automatically via `localStorage`.

### Step 2: Dashboard & Investigation Inception
1. You will arrive on the **Dashboard** (`/dashboard`).
2. Review the four stat cards:
   - **Total Cases**
   - **In Progress**
   - **Completed**
   - **Recent (7 Days)**
3. Click **"New Investigation"**. In the modal, input:
   - **Title**: `Central Plaza Commercial Burglary Suspect`
   - **RMS Reference**: `CAD-2026-99210`
4. Click **"Create & Begin Intake"**.

### Step 3: Multi-Modal Witness Intake
1. On the **Witness Intake** page (`/cases/:id/inputs`), select the **"Witness Statement & Descriptors"** tab.
2. Enter the narrative text:
   > "The suspect appeared to be a male around 28 to 32 years old, approximately 5'11\" with an athletic build. He had short dark fade hair, sharp hazel eyes, and a neat trimmed goatee with a strong square jawline."
3. Select optional structured fields:
   - Estimated Age: `28-32`
   - Jawline: `Square angular jaw`
   - Hair Style: `Short fade`
4. Click **"Save Statement"**.
5. Switch to the **"Audio Interview Recording"** tab to upload or simulate audio transcription.
6. Switch to the **"Reference Imagery"** tab to upload an observable reference photo (EXIF and GPS coordinates are stripped upon upload).
7. Click **"Process & Send for Analysis"**.

### Step 4: Structured Facial Feature Report
1. You are redirected to the **Forensic Facial Report** page (`/cases/:id/report`).
2. Review the 4 core sections:
   - **Executive Summary**
   - **Facial Feature Matrix** (categorized by confidence: blue for witness-stated, green for image-observed, amber for ambiguous, gray for unknown)
   - **Confidence & Uncertainty Breakdown**
   - **Collapsible Original Witness Statement** (immutable read-only panel)
3. Click **"Edit Report"**, modify a field (e.g. change face shape or add notes), and click **"Save Changes"**.
4. Observe the report version bump from `v1` to `v2` in the header.
5. Click **"Proceed to Sketch Generator"**.

### Step 5: Forensic Sketch Generation
1. On the **Sketch Generation** page (`/cases/:id/sketch`), observe the side-by-side layout:
   - Left: Confirmed facial features report
   - Right: High-resolution graphite pencil sketch canvas
2. Notice the prominent legal disclaimer banner:
   > **"AI-generated investigative aid — not a verified identification"**
3. The sketch is rendered from the confirmed features matrix using the version-controlled prompt template `sketch_v1.txt`.

### Step 6: Natural Language Refinement & Forensic Guardrail
1. Click **"Refine Sketch"** to navigate to `/cases/:id/refine`.
2. Enter the instruction: `"Make jawline broader and squarer"`.
3. Click **"Apply Refinement"**. The system processes the delta and creates **Version 2**.
4. Use the version slider and side-by-side comparison to inspect the refinement progression.
5. Notice that Version 1 remains cryptographically preserved and byte-identical (verified by SHA256 checksum).

### Step 7: Sketch Overview & PDF Dossier Export
1. Navigate to `/cases/:id/overview`.
2. Review the comprehensive case overview:
   - Left panel: Composite image, version switcher, quick download buttons.
   - Right panel: Complete registry metadata, confirmed feature matrix, refinement history log.
3. Click **"Download PDF"**.
4. Open the generated PDF:
   - Header banner: `*** AI-GENERATED INVESTIGATIVE AID — NOT A VERIFIED IDENTIFICATION ***`
   - Case metadata, confirmed descriptors, refinement timeline.
   - Every page footer includes the mandatory forensic legal advisory.

---

## Part 2: Explicit Error Paths & Security Validations

### Error Path 1: Invalid Audio MIME Spoofing (HTTP 415)
- **Scenario**: An operator or attacker renames a malicious binary or `.exe` file to `.wav` and attempts an upload.
- **Verification**:
  ```bash
  curl -X POST "http://localhost:8000/api/cases/{case_id}/inputs/audio" \
    -H "Authorization: Bearer <TOKEN>" \
    -F "file=@malicious.exe;filename=recording.wav;type=audio/wav"
  ```
- **Expected Result**: **HTTP 415 Unsupported Media Type** (`"Invalid audio format. Magic bytes do not match allowed audio extensions"`).

### Error Path 2: Oversized File Upload (HTTP 413)
- **Scenario**: An operator attempts to upload a 26MB video/audio file exceeding `MAX_UPLOAD_MB=25`.
- **Expected Result**: **HTTP 413 Payload Too Large** (`"File size exceeds 25 MB cap"`).

### Error Path 3: Hallucination Guardrail & Confirmation Gate
- **Scenario**: In the refinement prompt, the operator asks for `"Add thick rectangular horn-rimmed glasses and a cheek scar"`.
- **Behavior**: Because neither glasses nor scars were mentioned in the original witness testimony, the backend flags `requires_confirmation: true`.
- **Result**: Generation is strictly **BLOCKED** until the operator explicitly reviews the confirmation modal and acknowledges the delta to prevent forensic fabrication.

### Error Path 4: Unconfigured AI Provider (HTTP 503)
- **Scenario**: Calling an AI service with `LLM_PROVIDER=none` or `IMAGE_PROVIDER=none` without dev fixtures.
- **Result**: **HTTP 503 Service Unavailable** with detail `{"detail": "LLM_API_KEY not set", "code": "PROVIDER_UNAVAILABLE"}`. The UI displays an explicit retry notification; no fake image or hallucinated text is ever produced.

### Error Path 5: Brute-Force Rate Limiting (HTTP 429)
- **Scenario**: 6 failed login attempts with invalid credentials within 60 seconds.
- **Result**: Attempts 1 through 5 return **401 Unauthorized**. The 6th attempt is blocked with **HTTP 429 Too Many Requests** (`"Too many failed login attempts. Please wait 60 seconds."`).

### Error Path 6: Direct Storage Snooping Blocked (HTTP 404)
- **Scenario**: An unauthorized user tries to access private storage directly via `http://localhost:8000/storage/sketch_xyz.png`.
- **Result**: Returns **404 Not Found**. Storage is accessible solely through authenticated `/api/files/{token}` routes verifying case ownership.
