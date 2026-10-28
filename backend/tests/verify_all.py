import os
import sys
import subprocess
from pathlib import Path

tests_dir = Path(__file__).resolve().parent
python_bin = sys.executable

phases = [
    ("Phase 3 (Auth, Security, Audit)", "verify_phase3.py"),
    ("Phase 4 (Case CRUD & RBAC)", "verify_phase4.py"),
    ("Phase 5 (Provider Abstraction)", "-m pytest tests/providers"),
    ("Phase 6 (Text Input & Analysis)", "verify_phase6.py"),
    ("Phase 7 (Audio Upload & Transcription)", "verify_phase7.py"),
    ("Phase 8 (Image Upload & Vision Descriptors)", "verify_phase8.py"),
    ("Phase 9 (Report Document UI & Versioning)", "verify_phase9.py"),
    ("Phase 10 (Sketch Generation & Prompt Versioning)", "verify_phase10.py"),
    ("Phase 11 (Refinement & Byte Immutability)", "verify_phase11.py"),
    ("Phase 12 (Sketch Overview & Case History)", "verify_phase12.py"),
    ("Phase 13 (Welcome, Dashboard, UI Standards)", "verify_phase13.py"),
    ("Phase 14 (Security Hardening & Rate Limiting)", "verify_phase14.py"),
]

def main():
    print("================================================================================")
    print("      CRIMESKETCH AI — MASTER ACCEPTANCE & VERIFICATION SUITE")
    print("================================================================================")

    results = []
    all_passed = True

    for name, script in phases:
        print(f"\n---> Running: {name}")
        if script.startswith("-m"):
            cmd = [python_bin] + script.split()
        else:
            cmd = [python_bin, str(tests_dir / script)]

        proc = subprocess.run(cmd, cwd=str(tests_dir.parent), capture_output=True, text=True)
        if proc.returncode == 0:
            print(f"[PASS] {name}")
            results.append((name, "PASS", "Verified via automated test suite"))
        else:
            print(f"[FAIL] {name}")
            print(proc.stdout)
            print(proc.stderr)
            results.append((name, "FAIL", proc.stderr[:100].strip()))
            all_passed = False

    print("\n================================================================================")
    print("                        FINAL ACCEPTANCE SUMMARY TABLE")
    print("================================================================================")
    print(f"{'#':<3} | {'Phase Verification Gate':<48} | {'Status':<6} | Evidence")
    print("-" * 88)
    for idx, (name, status, evidence) in enumerate(results, 1):
        print(f"{idx:<3} | {name:<48} | {status:<6} | {evidence}")
    print("-" * 88)

    if all_passed:
        print("\n[SUCCESS] ALL VERIFICATION GATES PASSED AUTOMATICALLY WITH ZERO REGRESSIONS.")
        return 0
    else:
        print("\n[ERROR] SOME VERIFICATION GATES FAILED. INSPECT LOGS ABOVE.")
        return 1

if __name__ == "__main__":
    sys.exit(main())
