"""Tests for onboarding checklist endpoints."""
import os
import pytest
import requests
import uuid

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
E2E_EMAIL = "e2e@orcanext.com"
E2E_PASSWORD = "NewPass@123"


def _login(session, email, password):
    r = session.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return r


@pytest.fixture
def e2e_client():
    s = requests.Session()
    _login(s, E2E_EMAIL, E2E_PASSWORD)
    # Reset onboarding flags to a clean state
    s.post(f"{BASE_URL}/api/onboarding/state", json={"skipped": False, "dismissed": False})
    yield s
    # Cleanup: restore flags
    s.post(f"{BASE_URL}/api/onboarding/state", json={"skipped": False, "dismissed": False})


@pytest.fixture
def new_user_client():
    """Create a fresh user (no company) to test the empty-state branch."""
    s = requests.Session()
    email = f"TEST_onb_{uuid.uuid4().hex[:8]}@example.com"
    r = s.post(f"{BASE_URL}/api/auth/register",
               json={"name": "Onb Test", "email": email, "password": "Test@1234"})
    assert r.status_code in (200, 201), f"Register failed: {r.status_code} {r.text}"
    return s


class TestOnboardingStatus:
    def test_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/onboarding/status")
        assert r.status_code in (401, 403)

    def test_status_shape_e2e_user(self, e2e_client):
        r = e2e_client.get(f"{BASE_URL}/api/onboarding/status")
        assert r.status_code == 200
        d = r.json()
        for k in ("steps", "completed_count", "total", "all_done", "skipped", "dismissed"):
            assert k in d, f"missing key {k} in {d}"
        assert d["total"] == 4
        for k in ("company", "client", "product", "service", "quote"):
            assert k in d["steps"]
        # e2e user has company + client + quotes, but no product/service
        assert d["steps"]["company"] is True
        assert d["steps"]["client"] is True
        assert d["steps"]["quote"] is True
        assert d["steps"]["product"] is False
        assert d["steps"]["service"] is False
        # completed_count aggregates product OR service into one
        assert d["completed_count"] == 3
        assert d["all_done"] is False

    def test_status_new_user_no_company(self, new_user_client):
        r = new_user_client.get(f"{BASE_URL}/api/onboarding/status")
        assert r.status_code == 200, f"got {r.status_code} {r.text}"
        d = r.json()
        assert d["steps"]["company"] is False
        assert d["steps"]["client"] is False
        assert d["steps"]["product"] is False
        assert d["steps"]["service"] is False
        assert d["steps"]["quote"] is False
        assert d["completed_count"] == 0
        assert d["all_done"] is False


class TestOnboardingState:
    def test_set_skipped_persists(self, e2e_client):
        r = e2e_client.post(f"{BASE_URL}/api/onboarding/state", json={"skipped": True})
        assert r.status_code == 200
        assert r.json().get("ok") is True

        r2 = e2e_client.get(f"{BASE_URL}/api/onboarding/status")
        assert r2.status_code == 200
        assert r2.json()["skipped"] is True
        assert r2.json()["dismissed"] is False

    def test_set_dismissed_persists(self, e2e_client):
        r = e2e_client.post(f"{BASE_URL}/api/onboarding/state", json={"dismissed": True})
        assert r.status_code == 200
        r2 = e2e_client.get(f"{BASE_URL}/api/onboarding/status")
        assert r2.json()["dismissed"] is True

    def test_reset_flags(self, e2e_client):
        e2e_client.post(f"{BASE_URL}/api/onboarding/state", json={"skipped": True, "dismissed": True})
        r = e2e_client.post(f"{BASE_URL}/api/onboarding/state", json={"skipped": False, "dismissed": False})
        assert r.status_code == 200
        d = e2e_client.get(f"{BASE_URL}/api/onboarding/status").json()
        assert d["skipped"] is False
        assert d["dismissed"] is False


class TestMultiTenant:
    def test_new_user_progress_isolated_from_e2e(self, new_user_client):
        # e2e user has real data. new user should not see it.
        d = new_user_client.get(f"{BASE_URL}/api/onboarding/status").json()
        assert d["completed_count"] == 0
        assert d["steps"]["client"] is False
        assert d["steps"]["quote"] is False


class TestAllDoneFlow:
    def test_create_product_makes_all_done(self, e2e_client):
        # Create a product so all 4 steps are done for e2e user
        created = e2e_client.post(f"{BASE_URL}/api/products",
                                  json={"name": "TEST_Onboarding_Product",
                                        "price": 10.0, "unit": "un"})
        assert created.status_code in (200, 201), f"{created.status_code} {created.text}"
        pid = created.json().get("id")
        try:
            d = e2e_client.get(f"{BASE_URL}/api/onboarding/status").json()
            assert d["steps"]["product"] is True
            assert d["completed_count"] == 4
            assert d["all_done"] is True
        finally:
            if pid:
                e2e_client.delete(f"{BASE_URL}/api/products/{pid}")
        d2 = e2e_client.get(f"{BASE_URL}/api/onboarding/status").json()
        assert d2["steps"]["product"] is False
        assert d2["completed_count"] == 3
