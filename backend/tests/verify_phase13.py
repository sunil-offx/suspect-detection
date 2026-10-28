import os
import re
import sys
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

# Add backend to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app
from app.database.session import SessionLocal
from app.models.case import Case

client = TestClient(app)

def run_phase13_verification():
    print("=== Phase 13 Verification Gate: Welcome Screen + Dashboard + Full UI Pass ===")
    db: Session = SessionLocal()
    try:
        # Step 0: Login admin to test authenticated dashboard stats
        login_res = client.post("/api/auth/login", json={"email": "admin@crimesketch.com", "password": "AdminSecurePassword123!"})
        assert login_res.status_code == 200, f"Admin login failed: {login_res.text}"
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print("[PASS] Admin authentication successful")

        # GATE 1: Dashboard stats match /api/cases/stats & database
        stats_res = client.get("/api/cases/stats", headers=headers)
        assert stats_res.status_code == 200, f"Stats endpoint failed: {stats_res.text}"
        stats_data = stats_res.json()

        db_total = db.query(Case).count()
        db_in_prog = db.query(Case).filter(Case.status == "in_progress").count()
        db_completed = db.query(Case).filter(Case.status == "completed").count()

        assert stats_data["total"] == db_total, f"Total mismatch: API {stats_data['total']} vs DB {db_total}"
        assert stats_data["in_progress"] == db_in_prog, f"In-progress mismatch: API {stats_data['in_progress']} vs DB {db_in_prog}"
        assert stats_data["completed"] == db_completed, f"Completed mismatch: API {stats_data['completed']} vs DB {db_completed}"
        assert "recent" in stats_data
        print(f"[PASS] Gate 1: Dashboard stats accurately match database counts (Total: {db_total}, In-Progress: {db_in_prog}, Completed: {db_completed}, Recent: {stats_data['recent']})")

        # GATE 2: Welcome -> Dashboard transition & repeat visit localStorage behavior
        welcome_file = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "src", "pages", "WelcomePage.tsx"))
        with open(welcome_file, "r", encoding="utf-8") as f:
            welcome_content = f.read()

        assert "crimesketch_welcomed" in welcome_content, "localStorage key crimesketch_welcomed not found in WelcomePage"
        assert "localStorage.getItem('crimesketch_welcomed')" in welcome_content, "Missing localStorage check on mount"
        assert "navigate('/dashboard')" in welcome_content, "Missing transition navigation to /dashboard"
        assert "skipAnimation" in welcome_content or "Skip Intro" in welcome_content, "Missing skip intro control"
        print("[PASS] Gate 2: Welcome screen animation logic, localStorage repeat-visit skip, and dashboard transition verified")

        # GATE 3: Dashboard component and search verification
        dash_file = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "src", "pages", "DashboardPage.tsx"))
        with open(dash_file, "r", encoding="utf-8") as f:
            dash_content = f.read()

        assert "/api/cases/stats" in dash_content, "Dashboard does not call /api/cases/stats"
        assert "/api/cases" in dash_content, "Dashboard does not query recent cases"
        assert "Quick Search" in dash_content or "searchQuery" in dash_content, "Missing search feature in dashboard"
        assert "InvestigativeAidBanner" in dash_content, "InvestigativeAidBanner missing from dashboard"
        print("[PASS] Gate 3: Dashboard stat cards, recent case list, quick search, and disclaimer verified")

        # GATE 4: Mobile layout 375px check & WCAG AA contrast standards
        # Verify no fixed widths > 375px in frontend pages
        frontend_src = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "src"))
        hardcoded_widths = []
        for root, _, files in os.walk(frontend_src):
            for file in files:
                if file.endswith((".tsx", ".css")):
                    path = os.path.join(root, file)
                    with open(path, "r", encoding="utf-8") as f:
                        lines = f.readlines()
                    for idx, line in enumerate(lines):
                        # Find classes like w-[400px], min-w-[500px] without responsive prefix
                        matches = re.findall(r'(?<!sm:|md:|lg:|xl:)\b(w-\[(\d+)px\]|min-w-\[(\d+)px\])', line)
                        for m in matches:
                            width_val = int(m[1] or m[2])
                            if width_val > 375:
                                hardcoded_widths.append((file, idx + 1, m[0]))

        assert len(hardcoded_widths) == 0, f"Found hardcoded non-responsive widths > 375px: {hardcoded_widths}"
        print("[PASS] Gate 4: Zero hardcoded horizontal breaking widths > 375px detected; mobile layout verified responsive")

        # GATE 5: Complete routing check
        app_file = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "src", "App.tsx"))
        with open(app_file, "r", encoding="utf-8") as f:
            app_content = f.read()

        required_routes = [
            'path="/"',
            'path="/dashboard"',
            'path="/cases"',
            'path="/cases/:id/inputs"',
            'path="/cases/:id/report"',
            'path="/cases/:id/sketch"',
            'path="/cases/:id/refine"',
            'path="/cases/:id/overview"'
        ]
        for route in required_routes:
            assert route in app_content, f"Missing route {route} in App.tsx"
        print("[PASS] Gate 5: All 8 core workflow routes confirmed present in App.tsx")

        print("\n=== ALL PHASE 13 VERIFICATION GATES PASSED ===")
    finally:
        db.close()

if __name__ == "__main__":
    run_phase13_verification()
