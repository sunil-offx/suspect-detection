# CrimeSketch AI — External Dependencies & Blockers Log

This document records all external third-party API dependencies that were not configured with live external API keys during testing. In strict adherence to CrimeSketch AI operating rules, **the system never silently mocks or fabricates AI output**. When an external provider is not configured, endpoints degrade gracefully by returning HTTP 503 (`ProviderUnavailable`) with an explicit operational error message.

---

## 1. Summary of External Dependencies

| Provider Category | Environment Variable | Supported Providers | Current Configuration | Status | Behavior When Unset |
|---|---|---|---|---|---|
| **Facial Analysis (LLM)** | `LLM_API_KEY` | `openai`, `anthropic`, `none` | `LLM_PROVIDER=none` | **BLOCKED: Missing Key** | Returns HTTP 503 (`LLM_API_KEY not set`); 0 partial reports persisted. When `DEV_FIXTURES=1`, allows explicit test fixtures. |
| **Audio Transcription** | `WHISPER_API_KEY` | `openai`, `local`, `none` | `WHISPER_PROVIDER=none` | **BLOCKED: Missing Key** | Returns HTTP 503 (`WHISPER_API_KEY not set`); preserves raw audio reference in storage. |
| **Sketch Generation** | `IMAGE_API_KEY` | `replicate`, `fal`, `stability`, `none` | `IMAGE_PROVIDER=none` | **BLOCKED: Missing Key** | Returns HTTP 503 (`IMAGE_API_KEY not set`); 0 image files or database rows created. |

---

## 2. Detailed Provider Specifications & How to Unblock

### A. Large Language Model (Facial Feature Extraction & Analysis)
- **Role**: Analyzes free-form witness narratives and observable structured attributes into a strictly typed, non-hallucinating forensic facial feature report (`FacialReportSchema`).
- **Required Env Vars**:
  ```bash
  LLM_PROVIDER=openai           # or 'anthropic'
  LLM_API_KEY=sk-...            # Your live OpenAI or Anthropic API key
  LLM_MODEL=gpt-4o-mini         # or 'claude-3-5-sonnet-20241022'
  ```
- **How to Unblock**:
  1. Add `LLM_PROVIDER=openai` and `LLM_API_KEY=sk-...` to your `backend/.env` file.
  2. Restart the backend service.
  3. When an operator clicks **"Process & Send for Analysis"**, live structured extraction will execute.

### B. Speech-to-Text Transcription (Whisper)
- **Role**: Transcribes recorded witness audio interviews (MP3, WAV, M4A, WEBM) into structured verbatim text.
- **Required Env Vars**:
  ```bash
  WHISPER_PROVIDER=openai       # or 'local'
  WHISPER_API_KEY=sk-...        # OpenAI API key (or leave empty if local whisper model installed)
  WHISPER_MODEL=whisper-1
  ```
- **How to Unblock**:
  1. Add `WHISPER_PROVIDER=openai` and `WHISPER_API_KEY=sk-...` to `backend/.env`.
  2. Upload an audio recording via the witness intake interface.
  3. Transcription will automatically populate the narrative statement.

### C. Forensic Composite Sketch Generation
- **Role**: Generates a standardized, front-facing police forensic graphite composite sketch based exclusively on confirmed facial features and the version-controlled prompt template (`app/services/prompts/sketch_v1.txt`).
- **Required Env Vars**:
  ```bash
  IMAGE_PROVIDER=replicate      # or 'fal'
  IMAGE_API_KEY=r8_...          # Replicate or Fal API key
  IMAGE_MODEL=flux-schnell      # or flux-dev
  ```
- **How to Unblock**:
  1. Add `IMAGE_PROVIDER=replicate` and `IMAGE_API_KEY=r8_...` to `backend/.env`.
  2. Generate or refine a sketch from the confirmed report interface.

---

## 3. Explicit Development Fixture Mode (`DEV_FIXTURES=1`)

To allow verifiable end-to-end integration testing without incurring API billing or requiring external keys, CrimeSketch AI provides an explicit dev-fixture mode:

- **Activation**: Set `DEV_FIXTURES=1` in `backend/.env`.
- **Transparency**: Requests must explicitly query `?use_fixture=true`. If `DEV_FIXTURES=0` or unset, any attempt to use fixtures returns HTTP 403 Forbidden.
- **Fixtures Located in**:
  - [`backend/app/fixtures/sample_facial_report.json`](file:///d:/Suspect_Detection/backend/app/fixtures/sample_facial_report.json)
  - [`backend/app/fixtures/sample_sketch.png`](file:///d:/Suspect_Detection/backend/app/fixtures/sample_sketch.png)
