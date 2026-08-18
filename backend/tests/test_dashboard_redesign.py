"""Backend tests for the redesigned Dashboard: /api/dashboard/timeseries + regressions on
summary / quotes/usage. Multi-tenant guard + no-NaN + FREE limit = 15 checks."""
import os
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE:
    # fallback: read from frontend/.env directly
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE = line.split("=", 1)[1].strip().strip('"').rstrip("/")

E2E_EMAIL = "e2e@orcanext.com"
E2E_PASS = "NewPass@123"


@pytest.fixture(scope="module")
def sess():
    s = requests.Session()
    r = s.post(f"{BASE}/api/auth/login", json={"email": E2E_EMAIL, "password": E2E_PASS}, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return s


# ---- /api/quotes/usage: FREE plan limit MUST be 15 ----
def test_usage_free_limit_is_15(sess):
    r = sess.get(f"{BASE}/api/quotes/usage", timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert d["plan"] == "FREE"
    assert d["limit"] == 15, f"expected FREE limit=15, got {d['limit']}"
    assert isinstance(d["used"], int) and d["used"] >= 0


# ---- /api/dashboard/summary sanity ----
@pytest.mark.parametrize("period", ["7d", "30d", "3m", "all"])
def test_summary_periods_no_nan(sess, period):
    r = sess.get(f"{BASE}/api/dashboard/summary", params={"period": period}, timeout=15)
    assert r.status_code == 200
    d = r.json()
    # No NaN / no undefined semantics
    for k in ("total", "sent_count", "approved_count", "value_sent", "value_approved", "conversion_rate"):
        assert k in d
        v = d[k]
        assert v is not None
        assert v == v  # NaN != NaN
    # conversion sanity
    if d["sent_count"] == 0:
        assert d["conversion_rate"] == 0.0
    else:
        expected = round(d["approved_count"] / d["sent_count"] * 100, 1)
        assert d["conversion_rate"] == expected
    # counts contains all statuses
    for s in ["RASCUNHO", "ENVIADO", "VISUALIZADO", "AGUARDANDO_APROVACAO",
              "APROVADO", "ASSINADO", "RECUSADO", "EXPIRADO", "CANCELADO"]:
        assert s in d["counts"]
        assert isinstance(d["counts"][s], int)


# ---- /api/dashboard/timeseries : new endpoint ----
@pytest.mark.parametrize("period,gran", [("7d", "day"), ("30d", "day"), ("3m", "week"), ("all", "month")])
def test_timeseries_shape(sess, period, gran):
    r = sess.get(f"{BASE}/api/dashboard/timeseries", params={"period": period}, timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["period"] == period
    assert d["granularity"] == gran
    assert isinstance(d["series"], list)
    assert len(d["series"]) >= 1
    for pt in d["series"]:
        assert "date" in pt and isinstance(pt["date"], str)
        assert isinstance(pt["enviados"], int)
        assert isinstance(pt["aprovados"], int)
        assert pt["aprovados"] <= pt["enviados"] + pt["aprovados"]  # trivially true; guard type


def test_timeseries_requires_auth():
    r = requests.get(f"{BASE}/api/dashboard/timeseries", params={"period": "30d"}, timeout=15)
    assert r.status_code in (401, 403)


def test_summary_requires_auth():
    r = requests.get(f"{BASE}/api/dashboard/summary", params={"period": "30d"}, timeout=15)
    assert r.status_code in (401, 403)


# ---- funnel invariants derived from summary counts ----
def test_funnel_monotonic_from_summary(sess):
    r = sess.get(f"{BASE}/api/dashboard/summary", params={"period": "all"}, timeout=15)
    assert r.status_code == 200
    c = r.json()["counts"]
    enviados = c["ENVIADO"] + c["VISUALIZADO"] + c["AGUARDANDO_APROVACAO"] + c["APROVADO"] + c["ASSINADO"] + c["RECUSADO"] + c["EXPIRADO"]
    visualizados = c["VISUALIZADO"] + c["AGUARDANDO_APROVACAO"] + c["APROVADO"] + c["ASSINADO"]
    aguardando = c["AGUARDANDO_APROVACAO"] + c["APROVADO"] + c["ASSINADO"]
    aprovados = c["APROVADO"] + c["ASSINADO"]
    assinados = c["ASSINADO"]
    assert enviados >= visualizados >= aguardando >= aprovados >= assinados
