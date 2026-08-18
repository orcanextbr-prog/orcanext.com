"""Stripe TEST -> LIVE migration audit (iteration 4).

Verifies:
  1. Backend .env has all expected LIVE identifiers and no TEST leftovers.
  2. No `sk_test_`, `pk_test_`, `whsec_r7ug`, `acct_1U4tBM` refs anywhere in
     /app/backend or /app/frontend/src.
  3. Frontend does not embed any Stripe publishable key or price/product IDs.
  4. POST /api/stripe/checkout for monthly & yearly returns a `cs_live_` session
     whose retrieved details match the exact LIVE Price ID / Product / amount /
     currency / recurring interval.
  5. POST /api/stripe/webhook without signature -> 400 "Assinatura inválida".
  6. POST /api/plan/upgrade -> 410 (deprecated).
  7. POST /api/stripe/customer-portal for user w/o stripe_customer_id -> 400.
  8. Regression: /health 200, /api/plan sane, login e2e user works.
"""
from __future__ import annotations

import os
import re
import subprocess
from pathlib import Path

import pytest
import requests
import stripe

BASE_URL = os.environ["REACT_APP_BACKEND_URL"] if os.environ.get("REACT_APP_BACKEND_URL") else None
if not BASE_URL:
    # Fallback to frontend .env — required for CI where env isn't inherited.
    fe_env = Path("/app/frontend/.env").read_text()
    for line in fe_env.splitlines():
        if line.startswith("REACT_APP_BACKEND_URL="):
            BASE_URL = line.split("=", 1)[1].strip()
            break
BASE_URL = BASE_URL.rstrip("/")

# Load backend env vars directly (server runs with them, but pytest process may not).
BE_ENV: dict[str, str] = {}
for line in Path("/app/backend/.env").read_text().splitlines():
    if "=" in line and not line.strip().startswith("#"):
        k, v = line.split("=", 1)
        BE_ENV[k.strip()] = v.strip().strip('"').strip("'")

STRIPE_SECRET_KEY = BE_ENV.get("STRIPE_SECRET_KEY", "")
EXPECTED = {
    "STRIPE_MODE": "live",
    "STRIPE_WEBHOOK_SECRET": "whsec_xPIslGh9gcMYIVuOFmoZPeqGMJY2Tfsu",
    "STRIPE_MONTHLY_PRODUCT_ID": "prod_V5puhDlK4Tl46d",
    "STRIPE_MONTHLY_PRICE_ID": "price_1U5eEo5gVqE71TBy4OHNUN4F",
    "STRIPE_ANNUAL_PRODUCT_ID": "prod_V5puhDlK4Tl46d",
    "STRIPE_ANNUAL_PRICE_ID": "price_1U5eFn5gVqE71TBy68GGYLGR",
}

E2E_EMAIL = "e2e@orcanext.com"
E2E_PASSWORD = "NewPass@123"


# ---------- fixtures ---------------------------------------------------------
@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="module")
def auth_token(s):
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": E2E_EMAIL, "password": E2E_PASSWORD})
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text[:200]}"
    body = r.json()
    return body.get("access_token") or body["token"]


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


# ---------- 1. env sanity ---------------------------------------------------
class TestEnvConfig:
    def test_secret_and_publishable_are_live(self):
        assert STRIPE_SECRET_KEY.startswith("sk_live_"), "STRIPE_SECRET_KEY must be sk_live_"
        assert BE_ENV.get("STRIPE_PUBLISHABLE_KEY", "").startswith("pk_live_"), "publishable must be pk_live_"

    @pytest.mark.parametrize("k,v", list(EXPECTED.items()))
    def test_expected_value(self, k, v):
        assert BE_ENV.get(k) == v, f"{k}: got {BE_ENV.get(k)!r}, expected {v!r}"


# ---------- 2. no TEST leftovers -------------------------------------------
class TestAuditNoTestLeftovers:
    def test_no_test_refs_in_backend_or_frontend(self):
        pattern = r"sk_test_|pk_test_|whsec_r7ug|acct_1U4tBMA"
        out = subprocess.run(
            ["grep", "-rE", "--exclude-dir=tests", pattern, "/app/backend", "/app/frontend/src"],
            capture_output=True, text=True,
        )
        # grep exits 1 when no matches -> that's what we want
        matches = out.stdout.strip()
        assert not matches, f"leftover TEST refs:\n{matches}"

    def test_frontend_has_no_hardcoded_stripe_keys_or_ids(self):
        # publishable key + LIVE price / product IDs must NOT be embedded in bundled source
        forbidden = r"pk_live_|sk_live_|price_1U5|prod_V5"
        out = subprocess.run(
            ["grep", "-rE", forbidden, "/app/frontend/src"],
            capture_output=True, text=True,
        )
        assert not out.stdout.strip(), f"frontend leaks Stripe secrets/IDs:\n{out.stdout}"


# ---------- 3. checkout LIVE assertions ------------------------------------
def _assert_live_session(session_id: str, *, expected_price: str, expected_product: str,
                        expected_amount: int, expected_interval: str):
    assert session_id.startswith("cs_live_"), f"expected cs_live_ session, got {session_id!r}"
    stripe.api_key = STRIPE_SECRET_KEY
    sess = stripe.checkout.Session.retrieve(session_id, expand=["line_items", "line_items.data.price.product"])
    assert sess.livemode is True, "session.livemode must be True"
    assert sess.mode == "subscription"
    li = sess.line_items.data[0]
    price = li.price
    assert price.id == expected_price, f"price.id={price.id}"
    prod = price.product if isinstance(price.product, str) else price.product.id
    assert prod == expected_product, f"product={prod}"
    assert price.currency == "brl", f"currency={price.currency}"
    assert price.unit_amount == expected_amount, f"unit_amount={price.unit_amount}"
    assert price.recurring.interval == expected_interval, f"interval={price.recurring.interval}"


class TestStripeCheckoutLive:
    def test_checkout_monthly_live(self, s, auth_headers):
        r = s.post(f"{BASE_URL}/api/stripe/checkout",
                   headers=auth_headers,
                   json={"billing_cycle": "monthly", "origin_url": "https://app.orcanext.com"})
        assert r.status_code == 200, r.text[:400]
        j = r.json()
        assert "session_id" in j and "checkout_url" in j
        _assert_live_session(
            j["session_id"],
            expected_price="price_1U5eEo5gVqE71TBy4OHNUN4F",
            expected_product="prod_V5puhDlK4Tl46d",
            expected_amount=4990,
            expected_interval="month",
        )

    def test_checkout_yearly_live(self, s, auth_headers):
        r = s.post(f"{BASE_URL}/api/stripe/checkout",
                   headers=auth_headers,
                   json={"billing_cycle": "yearly", "origin_url": "https://app.orcanext.com"})
        assert r.status_code == 200, r.text[:400]
        j = r.json()
        _assert_live_session(
            j["session_id"],
            expected_price="price_1U5eFn5gVqE71TBy68GGYLGR",
            expected_product="prod_V5puhDlK4Tl46d",
            expected_amount=47880,
            expected_interval="year",
        )


# ---------- 4. webhook / deprecated / portal --------------------------------
class TestWebhookAndDeprecated:
    def test_webhook_without_signature_rejected(self, s):
        r = s.post(f"{BASE_URL}/api/stripe/webhook",
                   headers={"Content-Type": "application/json"},
                   data=b'{"id":"evt_test","type":"noop"}')
        assert r.status_code == 400, f"expected 400 got {r.status_code} {r.text[:200]}"
        assert "Assinatura inválida" in r.text or "Assinatura" in r.text

    def test_plan_upgrade_deprecated(self, s, auth_headers):
        r = s.post(f"{BASE_URL}/api/plan/upgrade", headers=auth_headers, json={})
        assert r.status_code == 410, f"expected 410 got {r.status_code} {r.text[:200]}"

    def test_customer_portal_no_subscription_returns_400(self, s, auth_headers):
        # e2e user may have gotten a stripe_customer_id from earlier checkout tests
        # in this same run. Unset it directly in Mongo to verify the 400 branch.
        import pymongo, os as _os
        client = pymongo.MongoClient(BE_ENV["MONGO_URL"])
        client[BE_ENV["DB_NAME"]].users.update_one(
            {"email": E2E_EMAIL},
            {"$unset": {"stripe_customer_id": ""}},
        )
        client.close()
        r = s.post(f"{BASE_URL}/api/stripe/customer-portal",
                   headers=auth_headers,
                   json={"origin_url": "https://app.orcanext.com"})
        assert r.status_code == 400, f"expected 400 got {r.status_code} {r.text[:200]}"


# ---------- 5. regression ----------------------------------------------------
class TestRegression:
    def test_health(self, s):
        r = s.get(f"{BASE_URL}/api/health")
        assert r.status_code == 200

    def test_plan_endpoint(self, s, auth_headers):
        r = s.get(f"{BASE_URL}/api/plan", headers=auth_headers)
        assert r.status_code == 200
        j = r.json()
        # spec: plan/prices/free_limit
        assert "plan" in j or "plans" in j, f"missing plan key: {j}"
        assert "prices" in j, f"missing prices key: {j}"
        assert "free_limit" in j, f"missing free_limit key: {j}"

    def test_login_e2e_user(self, s):
        r = s.post(f"{BASE_URL}/api/auth/login", json={"email": E2E_EMAIL, "password": E2E_PASSWORD})
        assert r.status_code == 200
        body = r.json()
        assert body.get("access_token") or body.get("token")
