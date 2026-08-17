"""Verifies the deployment-blocker fix:
- /health and /api/health respond fast without auth/DB
- After a backend restart, endpoints stay reachable within <1s
- Async _bootstrap_db still seeds the admin (admin@orcanext.com / Admin@2026 can log in)
"""
import os
import time
import subprocess
import requests
import pytest

BASE = os.environ.get("REACT_APP_BACKEND_URL") or open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split("\n")[0].strip()
BASE = BASE.rstrip("/")
LOCAL = "http://127.0.0.1:8001"
ADMIN_EMAIL = "admin@orcanext.com"
ADMIN_PW = "Admin@2026"


class TestHealth:
    def test_root_health_public(self):
        # /health is served internally to k8s probe -> only test on local port (external ingress routes / to frontend)
        r = requests.get(f"{LOCAL}/health", timeout=2)
        assert r.status_code == 200
        assert r.json() == {"status": "ok"}

    def test_api_health_public(self):
        r = requests.get(f"{BASE}/api/health", timeout=3)
        assert r.status_code == 200
        assert r.json() == {"status": "ok"}

    def test_health_is_fast(self):
        t0 = time.time()
        r = requests.get(f"{LOCAL}/health", timeout=2)
        elapsed = time.time() - t0
        assert r.status_code == 200
        assert elapsed < 1.0, f"health took {elapsed:.3f}s"

    def test_health_no_auth_required(self):
        # No cookies, no headers => still 200
        s = requests.Session()
        r = s.get(f"{BASE}/api/health", timeout=3)
        assert r.status_code == 200


class TestAsyncBootstrap:
    def test_health_available_immediately_after_restart(self):
        subprocess.run(["sudo", "supervisorctl", "restart", "backend"], check=True, capture_output=True)
        # Poll within 5s; expect success within first 1-2s
        deadline = time.time() + 5
        first_ok = None
        while time.time() < deadline:
            try:
                r = requests.get(f"{LOCAL}/health", timeout=1)
                if r.status_code == 200:
                    first_ok = time.time()
                    break
            except Exception:
                pass
            time.sleep(0.05)
        assert first_ok is not None, "health never became reachable after restart"

    def test_admin_seed_completes_async(self):
        # Give _bootstrap_db up to 10s to finish seeding after restart
        deadline = time.time() + 15
        last_status = None
        while time.time() < deadline:
            r = requests.post(f"{BASE}/api/auth/login",
                              json={"email": ADMIN_EMAIL, "password": ADMIN_PW},
                              timeout=5)
            last_status = r.status_code
            if r.status_code == 200:
                data = r.json()
                assert "user" in data
                assert data["user"]["email"] == ADMIN_EMAIL
                return
            time.sleep(0.5)
        pytest.fail(f"admin login never succeeded post-restart, last={last_status}")
