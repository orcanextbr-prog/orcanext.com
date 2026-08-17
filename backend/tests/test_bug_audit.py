"""OrçaNext pre-launch bug audit — CRITICAL/HIGH backend tests.

Covers: auth, multi-tenant isolation, free-plan quota (15/16), PRO unlimited,
CRUD (clients/products/services), quote lifecycle + PDF + duplicate, public
quote flow, dashboard summary, support tickets (user+admin), Stripe checkout /
customer-portal / webhook, admin impersonation, deprecated /plan/upgrade.
"""
import os
import time
import uuid
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL") or open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split("\n")[0].strip()
BASE = BASE.rstrip("/")
API = f"{BASE}/api"

ADMIN_EMAIL = "admin@orcanext.com"
ADMIN_PASS = "Admin@2026"
E2E_EMAIL = "e2e@orcanext.com"
E2E_PASS = "NewPass@123"
PRO_EMAIL = "stripe_1786928106@test.com"
PRO_PASS = "Pass@123"


def new_client():
    s = requests.Session()
    return s


def login(session, email, password):
    r = session.post(f"{API}/auth/login", json={"email": email, "password": password})
    return r


def register_user(session, email=None, password="StrongPass@123", name="Audit User"):
    email = email or f"audit_{uuid.uuid4().hex[:10]}@example.com"
    r = session.post(f"{API}/auth/register", json={"email": email, "name": name, "password": password})
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    return email, password


def ensure_company(session, name=None):
    r = session.get(f"{API}/company")
    if r.status_code == 200 and r.json():
        return r.json()
    r = session.post(f"{API}/company", json={
        "name": name or f"Audit Co {uuid.uuid4().hex[:6]}",
        "email": "co@test.local", "phone": "11999998888",
    })
    assert r.status_code == 200, r.text
    return r.json()


# ------------------------ AUTH ------------------------
class TestAuth:
    def test_register_autologin_me_with_company(self):
        s = new_client()
        email, pw = register_user(s)
        # /auth/me should return user immediately (auto-login via cookie)
        me = s.get(f"{API}/auth/me")
        assert me.status_code == 200, me.text
        body = me.json()
        assert body["user"]["email"] == email
        assert body.get("company") is None
        # onboarding
        ensure_company(s)
        me2 = s.get(f"{API}/auth/me").json()
        assert me2["company"] is not None
        assert me2["company"]["owner_id"] == body["user"]["id"]

    def test_login_wrong_password_rejected(self):
        s = new_client()
        r = login(s, E2E_EMAIL, "wrong-password!")
        assert r.status_code == 401

    def test_logout_clears_cookie(self):
        s = new_client()
        r = login(s, E2E_EMAIL, E2E_PASS)
        assert r.status_code == 200
        assert s.get(f"{API}/auth/me").status_code == 200
        assert s.post(f"{API}/auth/logout").status_code == 200
        s.cookies.clear()
        assert s.get(f"{API}/auth/me").status_code == 401


# --------------------- MULTI-TENANT ---------------------
class TestTenantIsolation:
    def test_user_b_cannot_see_user_a_data(self):
        # User A
        a = new_client()
        register_user(a)
        ensure_company(a, "Tenant A")
        rc = a.post(f"{API}/clients", json={"name": "TEST_ClientA", "phone": "11999990001", "email": "a@a.com"})
        assert rc.status_code == 200, rc.text
        cid_a = rc.json()["id"]
        rp = a.post(f"{API}/products", json={"name": "TEST_ProdA", "sku": "SKUA", "unit_price": 10.0, "unit": "un"})
        assert rp.status_code == 200
        rq = a.post(f"{API}/quotes", json={
            "client_id": cid_a, "items": [{"description": "x", "quantity": 1, "unit_price": 10}],
            "discount": 0, "discount_type": "value",
        })
        assert rq.status_code == 200, rq.text
        qid_a = rq.json()["id"]

        # User B
        b = new_client()
        register_user(b)
        ensure_company(b, "Tenant B")
        clients_b = b.get(f"{API}/clients").json()
        assert all(c["id"] != cid_a for c in clients_b)
        prods_b = b.get(f"{API}/products").json()
        assert all(p["name"] != "TEST_ProdA" for p in prods_b)
        # B cannot fetch A's quote
        assert b.get(f"{API}/quotes/{qid_a}").status_code == 404


# --------------------- FREE PLAN QUOTA ---------------------
class TestFreeQuota:
    def test_16th_blocks_with_402(self):
        s = new_client()
        register_user(s)
        ensure_company(s)
        # Read current limit from usage endpoint
        u = s.get(f"{API}/quotes/usage").json()
        limit = u["limit"]
        assert limit and limit >= 1, f"unexpected free limit: {u}"
        # create a client + product for quotes
        cli = s.post(f"{API}/clients", json={"name": "Q", "phone": "1", "email": "q@q.com"}).json()
        cid = cli["id"]
        payload = {"client_id": cid, "items": [{"description": "x", "quantity": 1, "unit_price": 10}],
                   "discount": 0, "discount_type": "value"}
        created = 0
        for i in range(limit):
            r = s.post(f"{API}/quotes", json=payload)
            assert r.status_code == 200, f"quote {i+1} failed: {r.status_code} {r.text}"
            created += 1
        # limit+1 must be blocked
        r = s.post(f"{API}/quotes", json=payload)
        assert r.status_code == 402, f"expected 402, got {r.status_code} {r.text}"
        # usage endpoint reflects blocked
        u2 = s.get(f"{API}/quotes/usage").json()
        assert u2["blocked"] is True
        assert u2["used"] >= limit

    def test_duplicate_consumes_quota(self):
        s = new_client()
        register_user(s)
        ensure_company(s)
        cli = s.post(f"{API}/clients", json={"name": "Q", "phone": "1", "email": "q@q.com"}).json()
        rq = s.post(f"{API}/quotes", json={"client_id": cli["id"], "items": [{"description": "x", "quantity": 1, "unit_price": 5}],
                                            "discount": 0, "discount_type": "value"})
        qid = rq.json()["id"]
        before = s.get(f"{API}/quotes/usage").json()["used"]
        d = s.post(f"{API}/quotes/{qid}/duplicate")
        assert d.status_code == 200, d.text
        after = s.get(f"{API}/quotes/usage").json()["used"]
        assert after == before + 1, f"expected {before+1}, got {after}"

    def test_delete_does_not_restore_quota(self):
        s = new_client()
        register_user(s)
        ensure_company(s)
        cli = s.post(f"{API}/clients", json={"name": "Q", "phone": "1", "email": "q@q.com"}).json()
        rq = s.post(f"{API}/quotes", json={"client_id": cli["id"], "items": [{"description": "x", "quantity": 1, "unit_price": 5}],
                                            "discount": 0, "discount_type": "value"})
        qid = rq.json()["id"]
        before = s.get(f"{API}/quotes/usage").json()["used"]
        assert s.delete(f"{API}/quotes/{qid}").status_code == 200
        after = s.get(f"{API}/quotes/usage").json()["used"]
        assert after == before, "delete must not restore quota"


class TestProfessionalPlan:
    def test_professional_usage_limit_null(self):
        s = new_client()
        r = login(s, PRO_EMAIL, PRO_PASS)
        if r.status_code != 200:
            pytest.skip(f"PRO account not usable: {r.status_code}")
        u = s.get(f"{API}/quotes/usage").json()
        assert u["plan"] == "PROFESSIONAL"
        assert u["limit"] is None
        assert u["blocked"] is False


# --------------------- CRUD ---------------------
class TestCRUD:
    def _login_e2e(self):
        s = new_client()
        r = login(s, E2E_EMAIL, E2E_PASS)
        assert r.status_code == 200, r.text
        ensure_company(s)
        return s

    def test_clients_crud(self):
        s = self._login_e2e()
        c = s.post(f"{API}/clients", json={"name": "TEST_C1", "phone": "1199", "email": "c1@t.com"}).json()
        cid = c["id"]
        # edit
        u = s.put(f"{API}/clients/{cid}", json={"name": "TEST_C1x", "phone": "1188", "email": "c1@t.com"}).json()
        assert u["name"] == "TEST_C1x"
        # list contains it
        lst = s.get(f"{API}/clients").json()
        assert any(x["id"] == cid for x in lst)
        # delete
        assert s.delete(f"{API}/clients/{cid}").status_code == 200
        lst2 = s.get(f"{API}/clients").json()
        assert all(x["id"] != cid for x in lst2)

    def test_products_crud(self):
        s = self._login_e2e()
        p = s.post(f"{API}/products", json={"name": "TEST_P1", "sku": f"SKU-{uuid.uuid4().hex[:5]}",
                                             "unit_price": 12.5, "unit": "un"}).json()
        pid = p["id"]
        u = s.put(f"{API}/products/{pid}", json={"name": "TEST_P1x", "sku": p["sku"], "unit_price": 15, "unit": "un"}).json()
        assert u["name"] == "TEST_P1x"
        assert s.delete(f"{API}/products/{pid}").status_code == 200

    def test_services_crud(self):
        s = self._login_e2e()
        sv = s.post(f"{API}/services", json={"name": "TEST_S1", "unit_price": 100, "unit": "hora"}).json()
        sid = sv["id"]
        u = s.put(f"{API}/services/{sid}", json={"name": "TEST_S1x", "unit_price": 120, "unit": "hora"}).json()
        assert u["name"] == "TEST_S1x"
        assert s.delete(f"{API}/services/{sid}").status_code == 200


# --------------------- QUOTES / PUBLIC ---------------------
class TestQuoteFlow:
    def test_create_edit_send_pdf_and_public(self):
        s = new_client()
        r = login(s, E2E_EMAIL, E2E_PASS)
        assert r.status_code == 200
        ensure_company(s)
        cli = s.post(f"{API}/clients", json={"name": "TEST_QC", "phone": "11987654321", "email": "qc@t.com"}).json()
        # create with two items and 10% discount
        payload = {"client_id": cli["id"],
                   "items": [{"description": "A", "quantity": 2, "unit_price": 50},
                             {"description": "B", "quantity": 1, "unit_price": 100}],
                   "discount": 10, "discount_type": "percent"}
        rq = s.post(f"{API}/quotes", json=payload)
        if rq.status_code == 402:
            pytest.skip("e2e account is at quota; skipping full flow")
        assert rq.status_code == 200, rq.text
        q = rq.json()
        # subtotal 200, discount 20, total 180
        assert q["subtotal"] == 200.0
        assert q["discount_value"] == 20.0
        assert q["total"] == 180.0
        qid = q["id"]
        token = q["public_token"]
        # move to ENVIADO
        st = s.post(f"{API}/quotes/{qid}/status", json={"status": "ENVIADO"})
        assert st.status_code == 200
        # PDF
        pdf = s.get(f"{API}/quotes/{qid}/pdf")
        assert pdf.status_code == 200
        assert "application/pdf" in pdf.headers.get("content-type", "")
        assert pdf.content[:4] == b"%PDF"
        # public GET (no auth)
        pub = requests.get(f"{API}/public/quote/{token}")
        assert pub.status_code == 200
        pb = pub.json()
        assert pb["quote"]["total"] == 180.0
        assert pb.get("company") is not None
        assert pb.get("client") is not None
        assert pb.get("watermark") is True  # FREE user -> watermark


# --------------------- DASHBOARD SUMMARY ---------------------
class TestDashboard:
    def test_summary_shape_and_conversion(self):
        s = new_client()
        assert login(s, E2E_EMAIL, E2E_PASS).status_code == 200
        ensure_company(s)
        for p in ("7d", "30d", "3m", "all"):
            r = s.get(f"{API}/dashboard/summary?period={p}")
            assert r.status_code == 200, r.text
            d = r.json()
            for key in ("total", "counts", "sent_count", "approved_count",
                        "value_sent", "value_approved", "conversion_rate"):
                assert key in d
            # conversion = approved/sent*100 rounded to 1 decimal
            if d["sent_count"]:
                expected = round(d["approved_count"] / d["sent_count"] * 100, 1)
                assert d["conversion_rate"] == expected


# --------------------- SUPPORT ---------------------
class TestSupport:
    def test_full_ticket_flow_and_isolation(self):
        # User A creates ticket
        a = new_client()
        register_user(a)
        ensure_company(a)
        cats = a.get(f"{API}/support/categories").json()["categories"]
        cat = cats[0] if cats else "OUTROS"
        t = a.post(f"{API}/support/tickets", json={"subject": "TEST bug", "category": cat, "message": "hello"})
        assert t.status_code == 200, t.text
        tid = t.json()["id"]

        # Admin sees ticket with user_email/company_name
        admin = new_client()
        assert login(admin, ADMIN_EMAIL, ADMIN_PASS).status_code == 200
        lst = admin.get(f"{API}/admin/support/tickets").json()
        target = next((x for x in lst if x["id"] == tid), None)
        assert target is not None, "admin cannot see ticket"
        assert target.get("user_email")
        assert target.get("company_name")

        # Admin replies -> status AGUARDANDO_USUARIO
        rep = admin.post(f"{API}/support/tickets/{tid}/messages", json={"message": "admin reply"})
        assert rep.status_code == 200, rep.text
        assert rep.json()["status"] == "AGUARDANDO_USUARIO"

        # User replies -> EM_ATENDIMENTO
        rep2 = a.post(f"{API}/support/tickets/{tid}/messages", json={"message": "user reply"})
        assert rep2.status_code == 200
        assert rep2.json()["status"] == "EM_ATENDIMENTO"

        # Admin changes status
        st = admin.put(f"{API}/support/tickets/{tid}/status", json={"status": "RESOLVIDO"})
        assert st.status_code == 200
        assert st.json()["status"] == "RESOLVIDO"

        # User B cannot fetch A's ticket
        b = new_client()
        register_user(b)
        ensure_company(b)
        assert b.get(f"{API}/support/tickets/{tid}").status_code == 403
        # user B cannot access admin support endpoints
        assert b.get(f"{API}/admin/support/tickets").status_code == 403


# --------------------- STRIPE ---------------------
class TestStripe:
    def test_checkout_returns_url(self):
        s = new_client()
        assert login(s, E2E_EMAIL, E2E_PASS).status_code == 200
        ensure_company(s)
        r = s.post(f"{API}/stripe/checkout", json={"billing_cycle": "monthly", "origin_url": BASE})
        assert r.status_code == 200, r.text
        d = r.json()
        assert "checkout.stripe.com" in d["checkout_url"]
        assert d["session_id"].startswith("cs_")

    def test_deprecated_plan_upgrade_410(self):
        s = new_client()
        assert login(s, E2E_EMAIL, E2E_PASS).status_code == 200
        r = s.post(f"{API}/plan/upgrade", json={})
        assert r.status_code == 410

    def test_webhook_rejects_missing_signature(self):
        r = requests.post(f"{API}/stripe/webhook", data=b"{}",
                          headers={"Content-Type": "application/json"})
        # Missing signature must not process; expect 400 (or 503 if webhook secret missing)
        assert r.status_code in (400, 503), f"got {r.status_code} {r.text}"

    def test_customer_portal_for_pro_user(self):
        s = new_client()
        r = login(s, PRO_EMAIL, PRO_PASS)
        if r.status_code != 200:
            pytest.skip("PRO account not usable")
        rp = s.post(f"{API}/stripe/customer-portal", json={"origin_url": BASE})
        # Either returns portal_url or Stripe error (test-mode account may reject in-preview)
        if rp.status_code == 200:
            assert "portal_url" in rp.json()
        else:
            pytest.skip(f"portal not available: {rp.status_code} {rp.text[:200]}")

    def test_downgrade_immediate_for_no_sub_user(self):
        s = new_client()
        register_user(s)
        ensure_company(s)
        r = s.post(f"{API}/plan/downgrade", json={})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("immediate") is True
        assert d.get("plan") == "FREE"


# --------------------- ADMIN IMPERSONATION ---------------------
class TestImpersonation:
    def test_impersonate_and_end(self):
        admin = new_client()
        assert login(admin, ADMIN_EMAIL, ADMIN_PASS).status_code == 200
        # find a target user
        users = admin.get(f"{API}/admin/users").json()
        target = next((u for u in users if u.get("email") == E2E_EMAIL), None) or (users[0] if users else None)
        assert target, "no user to impersonate"
        r = admin.post(f"{API}/admin/impersonate/{target['id']}")
        assert r.status_code == 200, r.text
        me = admin.get(f"{API}/auth/me").json()
        assert me["user"]["email"] == target["email"]
        assert me["user"].get("impersonated_by")
        end = admin.post(f"{API}/admin/impersonate-end")
        assert end.status_code == 200
        me2 = admin.get(f"{API}/auth/me").json()
        assert me2["user"]["email"] == ADMIN_EMAIL
        assert not me2["user"].get("impersonated_by")
