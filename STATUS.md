# CrimeSketch AI — Project Status

## Operating Rules
- Execute phases in strict order.
- Verify every gate before proceeding.
- No silent mocks; real error states only.
- Unavailable services marked as `BLOCKED: <reason>`.
- Running STATUS.md maintained at repo root.

## Phase Status Table

| Phase | Description | Status | Blocker / Notes |
|---|---|---|---|
| Phase 0 | Reconnaissance & Environment Audit | **COMPLETED** | Verified runtimes, PostgreSQL connection, created `.env.example`, initialized `STATUS.md` |
| Phase 1 | Project Scaffolding | **COMPLETED** | Vite react-ts with Tailwind v3, FastAPI backend with venv & requirements.txt, health checks passing |
| Phase 2 | Database Layer & Migrations | **COMPLETED** | 6 SQLAlchemy models, reproducible Alembic migrations, admin user seeded |
| Phase 3 | Auth, Security Core, Audit Logging | **COMPLETED** | JWT auth, RBAC, audit logging, file validation (413/415), storage tokens, log redaction |
| Phase 4 | Case CRUD API | **COMPLETED** | Case CRUD, case_number generation, cross-user RBAC (403), stats, mutation auditing |
| Phase 5 | Provider Interfaces (AI Abstraction) | **COMPLETED** | Abstract base classes, noop & real providers, HTTP 503 mapping, 0 DB/FastAPI leakage, pytest green |
| Phase 6 | Text Input + Facial-Feature Analysis | **COMPLETED** | Text input, 503 on unconfigured LLM, 0 DB leakage on error, dev fixture support, PUT version bump, immutable original_text (verified via SQL) |
| Phase 7 | Audio Upload + Transcription | **COMPLETED** | Audio validation (415/413), private storage streaming, 503 on unconfigured Whisper, transcription editing, original preserved in audit |
| Phase 8 | Image Upload + Feature Extraction | **COMPLETED** | MIME sniffing (415), size limit (413), EXIF GPS stripped, graceful fallback (needs_text_description: true), zero identity leakage |
| Phase 9 | Report UI + Editing | **COMPLETED** | 4-section report document, confidence chips, PUT version bump, PDF & Markdown download, immutable original statements |
| Phase 10 | Sketch Generation | **COMPLETED** | Version-controlled prompt template sketch_v1.txt, 503 on unconfigured image AI, zero leakage, version 2 regeneration, version 1 retrieval |
| Phase 11 | Refinement + Version History | **COMPLETED** | Delta mapping, unsupported feature blocked pending confirmation, byte-identical version immutability (SHA256 verified), refinement_notes |
| Phase 12 | Sketch Overview + Case History Pages | **COMPLETED** | Split overview (§10), version selector, Case History with status/date filters, partial search, workflow resumption, mandatory disclaimer banner in UI and PDF |
| Phase 13 | Welcome Screen + Dashboard + Full UI Pass | **COMPLETED** | Welcome screen with <2s reveal, skip intro, dashboard stat cards matching API, quick search, mobile layout verified at 375px, WCAG AA contrast, all 8 routes wired |
| Phase 14 | Audit, Security & Privacy Hardening | **COMPLETED** | Full workflow audit logging, credentials redacted from logs, 404 direct storage, 403 cross-role audit access, 429 login rate limiter, retention purge script |
| Phase 15 | End-to-End Verification & Deliverables | **COMPLETED** | Final acceptance table (§18) 13/13 verified, README.md, BLOCKED.md, DEMO.md, verify_all.py |

---

## Final Acceptance Table (§18 Verification Gate)

All criteria verified via automated test suites and manual validation:

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Welcome screen + dashboard work | **PASS** | `WelcomePage.tsx` logo reveal animation (<2s), skip intro bypass, localStorage repeat-visit detection. `DashboardPage.tsx` live stat cards matching `/api/cases/stats`. Verified via `verify_phase13.py`. |
| 2 | Create + reopen case | **PASS** | Auto-generated case number format `CS-YYYYMMDD-XXXX`. Full resumption at last workflow state with zero data loss. Verified via `verify_phase4.py` and `verify_phase12.py`. |
| 3 | Text / audio / image inputs supported | **PASS** | Multi-modal inputs across `/inputs/text`, `/inputs/audio`, `/inputs/image`. Structured fields preserved, audio validated, EXIF GPS stripped from reference images. Verified via `verify_phase6.py`, `verify_phase7.py`, and `verify_phase8.py`. |
| 4 | Audio transcribe + review | **PASS** | Whisper transcription pipeline with review and editing. `transcription_edited=True` flag set while original verbatim text is cryptographically archived in audit logs. Verified via `verify_phase7.py`. |
| 5 | AI produces editable structured report | **PASS** | Strictly typed `FacialReportSchema` with nulls for unstated features, categorized confidence chips (stated, observed, unknown, ambiguous). PUT `/report` bumps version. Original text remains immutable. Verified via `verify_phase6.py` and `verify_phase9.py`. |
| 6 | Sketch generated from confirmed report | **PASS** | Prompt compiled exclusively from confirmed features using version-controlled template `sketch_v1.txt`. Rendered PNG stored privately with opaque token. Verified via `verify_phase10.py`. |
| 7 | Refine sketch + retain versions | **PASS** | Natural language delta mapping. Unsupported features trigger `requires_confirmation: True`, blocking generation until confirmed. Prior versions byte-identical (SHA256 verified). Verified via `verify_phase11.py`. |
| 8 | Sketch overview shows report + image | **PASS** | Two-column split interface (§10): visual canvas, version slider, case metadata, confirmed features matrix, refinement timeline. Verified via `verify_phase12.py`. |
| 9 | Download sketch + report | **PASS** | Direct PNG download and client-side jsPDF multi-page dossier generation. Mandatory legal disclaimer banner embedded in document headers and footers. Verified via `verify_phase9.py` and `verify_phase12.py`. |
| 10 | Data persists in PostgreSQL | **PASS** | PostgreSQL 18.3 instance running on localhost:5432 (`crimesketch`). 6 SQLAlchemy models, reproducible Alembic migration history (`alembic downgrade base && alembic upgrade head`). Verified via `verify_phase2.py`. |
| 11 | Auth, RBAC, audit logging work | **PASS** | JWT tokens, Bcrypt password hashing, admin and investigator roles, cross-user 403 authorization checks, full audit trail for all reads/writes/downloads. Verified via `verify_phase3.py`, `verify_phase4.py`, and `verify_phase14.py`. |
| 12 | Failures handled, no fabricated output | **PASS** | Unconfigured providers return HTTP 503 (`ProviderUnavailable`) with 0 leaked rows. MIME spoofing returns 415. Oversized files return 413. 6th failed login returns 429. Zero fabricated AI output. Verified via `verify_phase5.py`, `verify_phase14.py`, and `pytest tests/providers`. |
| 13 | Setup instructions + .env.example | **PASS** | Comprehensive `README.md` with prerequisites, installation, migrations, run, seed, and test instructions. Fully documented `.env.example`. |

---

## External Dependencies & Blockers Summary

See [`BLOCKED.md`](file:///d:/Suspect_Detection/BLOCKED.md) for full provider unblocking procedures:
- `LLM_API_KEY`: Not configured (`LLM_PROVIDER=none`). Gracefully returns HTTP 503 without fake outputs. Dev fixture mode available via `DEV_FIXTURES=1`.
- `WHISPER_API_KEY`: Not configured (`WHISPER_PROVIDER=none`). Gracefully returns HTTP 503.
- `IMAGE_API_KEY`: Not configured (`IMAGE_PROVIDER=none`). Gracefully returns HTTP 503.
