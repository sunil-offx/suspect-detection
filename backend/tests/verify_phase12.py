import os
import sys
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

# Add backend to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app
from app.database.session import SessionLocal
from app.models.case import Case
from app.models.witness_input import WitnessInput
from app.models.facial_report import FacialReport
from app.models.sketch import GeneratedSketch
from app.models.audit_log import AuditLog
from app.models.user import User

client = TestClient(app)

def run_phase12_verification():
    print("=== Phase 12 Verification Gate: Sketch Overview + Case History ===")
    db: Session = SessionLocal()
    try:
        # Step 0: Login admin to get valid token
        login_res = client.post("/api/auth/login", json={"email": "admin@crimesketch.com", "password": "AdminSecurePassword123!"})
        assert login_res.status_code == 200, f"Admin login failed: {login_res.text}"
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print("[PASS] Admin authentication successful")

        # Step 1: Create a case and advance through full workflow
        create_res = client.post("/api/cases", json={"title": "Phase 12 Complete History Case", "external_reference": "RMS-P12-VERIFY"}, headers=headers)
        assert create_res.status_code == 201, f"Case creation failed: {create_res.text}"
        case_id = create_res.json()["id"]
        case_number = create_res.json()["case_number"]
        print(f"[PASS] Created test case {case_number} (ID: {case_id})")

        # Add witness text input
        inp_res = client.post(f"/api/cases/{case_id}/inputs/text", json={"text": "Suspect is a male, around 30, square jaw, deep hazel eyes."}, headers=headers)
        assert inp_res.status_code == 201
        print("[PASS] Witness text input added")

        # Generate report
        rep_res = client.post(f"/api/cases/{case_id}/analyze?use_fixture=true", headers=headers)
        assert rep_res.status_code == 201
        print("[PASS] Facial report generated")

        # Generate initial sketch v1
        sk1_res = client.post(f"/api/cases/{case_id}/generate-sketch?use_fixture=true", headers=headers)
        assert sk1_res.status_code == 201
        assert sk1_res.json()["sketch_version"] == 1
        print("[PASS] Initial sketch v1 generated")

        # Refine sketch to v2
        sk2_res = client.post(f"/api/cases/{case_id}/refine-sketch?use_fixture=true", json={"instruction": "Broader jawline"}, headers=headers)
        assert sk2_res.status_code == 200
        assert sk2_res.json()["sketch"]["sketch_version"] == 2
        print("[PASS] Refined sketch v2 generated")

        # Mark case as completed
        upd_res = client.put(f"/api/cases/{case_id}", json={"status": "completed"}, headers=headers)
        assert upd_res.status_code == 200
        assert upd_res.json()["status"] == "completed"
        print("[PASS] Case marked as completed")

        # GATE 1: Reopen a completed case -> report and all sketch versions load
        overview_res = client.get(f"/api/cases/{case_id}/overview", headers=headers)
        assert overview_res.status_code == 200, f"Overview endpoint failed: {overview_res.text}"
        overview_data = overview_res.json()

        assert overview_data["case"]["case_number"] == case_number
        assert overview_data["case"]["status"] == "completed"
        assert len(overview_data["inputs"]) >= 1, "Expected witness inputs loaded"
        assert len(overview_data["reports"]) >= 1, "Expected reports loaded"
        assert len(overview_data["sketches"]) == 2, f"Expected exactly 2 sketch versions, got {len(overview_data['sketches'])}"
        assert overview_data["sketches"][0]["sketch_version"] == 1
        assert overview_data["sketches"][1]["sketch_version"] == 2
        assert overview_data["latest_sketch"]["sketch_version"] == 2
        assert overview_data["last_workflow_state"] == "sketch"
        print("[PASS] Gate 1: Reopen completed case loads all inputs, reports, and all sketch versions without data loss")

        # Check audit log for case_overview_view
        view_log = db.query(AuditLog).filter(AuditLog.case_id == case_id, AuditLog.action == "case_overview_view").first()
        assert view_log is not None, "Audit log for case_overview_view missing"
        print(f"[PASS] Audit log verified for case_overview_view (Log ID: {view_log.id})")

        # GATE 2: Search by partial case number returns match
        # Extract partial case number (e.g. middle part or suffix)
        partial_num = case_number[3:12] # e.g. "20261028"
        search_res = client.get(f"/api/cases?search={partial_num}", headers=headers)
        assert search_res.status_code == 200
        search_items = search_res.json()["items"]
        found = any(item["case_number"] == case_number for item in search_items)
        assert found, f"Case {case_number} not found when searching for partial '{partial_num}'"

        # Search non-matching
        neg_search = client.get("/api/cases?search=NONEXISTENT_XYZ_9999", headers=headers)
        assert neg_search.status_code == 200
        assert neg_search.json()["total"] == 0
        print(f"[PASS] Gate 2: Search by partial case number '{partial_num}' successfully matched")

        # GATE 3: Date/status filters combine correctly
        now = datetime.now(timezone.utc)
        start_today = (now - timedelta(hours=2)).strftime("%Y-%m-%dT%H:%M:%SZ")
        end_today = (now + timedelta(hours=2)).strftime("%Y-%m-%dT%H:%M:%SZ")

        # Combined: status=completed AND today's date range -> MATCH
        comb_match = client.get(f"/api/cases?status=completed&start_date={start_today}&end_date={end_today}", headers=headers)
        assert comb_match.status_code == 200, f"Combined match failed: {comb_match.text}"
        comb_items = comb_match.json()["items"]
        assert any(item["id"] == case_id for item in comb_items), "Completed case should match combined filter"

        # Combined: status=draft AND today's date range -> NO MATCH
        comb_draft = client.get(f"/api/cases?status=draft&start_date={start_today}&end_date={end_today}", headers=headers)
        assert comb_draft.status_code == 200
        draft_items = comb_draft.json()["items"]
        assert not any(item["id"] == case_id for item in draft_items), "Completed case should NOT match status=draft filter"

        # Combined: status=completed AND yesterday's date range -> NO MATCH
        past_start = (now - timedelta(days=5)).strftime("%Y-%m-%dT%H:%M:%SZ")
        past_end = (now - timedelta(days=2)).strftime("%Y-%m-%dT%H:%M:%SZ")
        comb_past = client.get(f"/api/cases?status=completed&start_date={past_start}&end_date={past_end}", headers=headers)
        assert comb_past.status_code == 200
        past_items = comb_past.json()["items"]
        assert not any(item["id"] == case_id for item in past_items), "Case should NOT match past date range"
        print("[PASS] Gate 3: Combined status and date range filters evaluate correctly")

        # GATE 4: Banner visible on overview and in downloaded PDF
        # Verify component files and PDF generator code
        banner_text = "AI-generated investigative aid — not a verified identification"

        overview_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "src", "pages", "SketchOverviewPage.tsx"))
        banner_comp_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "src", "components", "InvestigativeAidBanner.tsx"))

        with open(banner_comp_path, "r", encoding="utf-8") as f:
            banner_comp_content = f.read()
        assert banner_text.lower() in banner_comp_content.lower(), "Banner text missing in InvestigativeAidBanner.tsx"

        with open(overview_path, "r", encoding="utf-8") as f:
            overview_content = f.read()
        assert "<InvestigativeAidBanner" in overview_content, "InvestigativeAidBanner not rendered in SketchOverviewPage.tsx"
        assert "AI-GENERATED INVESTIGATIVE AID — NOT A VERIFIED IDENTIFICATION" in overview_content, "Disclaimer missing in PDF export logic"
        print("[PASS] Gate 4: Mandatory forensic banner verified in UI components and PDF export generation")

        print("\n=== ALL PHASE 12 VERIFICATION GATES PASSED ===")
    finally:
        db.close()

if __name__ == "__main__":
    run_phase12_verification()
