"""OrçaNext backend - SaaS multi-tenant for professional quotes."""
from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import io
import re
import uuid
import jwt
import bcrypt
import secrets
import logging
import stripe
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal, Any
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, Query
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict

from pdf_generator import build_quote_pdf, build_receipt_pdf
from emailer import send_email, build_followup_html
import asyncio

# ---------- Config ----------
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGO = "HS256"
FREE_QUOTE_LIMIT = int(os.environ.get("FREE_QUOTE_LIMIT", "15"))
PRO_MONTHLY_PRICE = float(os.environ.get("PRO_MONTHLY_PRICE", "49.90"))
PRO_ANNUAL_PRICE = float(os.environ.get("PRO_ANNUAL_PRICE", "478.80"))

STRIPE_SECRET_KEY = os.environ.get("STRIPE_SECRET_KEY", "")
STRIPE_PUBLISHABLE_KEY = os.environ.get("STRIPE_PUBLISHABLE_KEY", "")
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
STRIPE_MODE = os.environ.get("STRIPE_MODE", "test")
STRIPE_MONTHLY_PRICE_ID = os.environ.get("STRIPE_MONTHLY_PRICE_ID", "")
STRIPE_ANNUAL_PRICE_ID = os.environ.get("STRIPE_ANNUAL_PRICE_ID", "")
STRIPE_LOOKUP_MONTHLY = "orcanext_pro_monthly"
STRIPE_LOOKUP_YEARLY = "orcanext_pro_yearly"
if STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="OrçaNext API")
api = APIRouter(prefix="/api")

logger = logging.getLogger("orcanext")
logging.basicConfig(level=logging.INFO)


# ---------- Helpers ----------
def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def create_access_token(uid: str, email: str, impersonated_by: Optional[str] = None) -> str:
    payload = {"sub": uid, "email": email, "type": "access",
               "exp": now_utc() + timedelta(days=7)}
    if impersonated_by:
        payload["impersonated_by"] = impersonated_by
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


def decode_token(token: str) -> dict:
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])


def month_period(dt: Optional[datetime] = None) -> tuple:
    dt = dt or now_utc()
    start = dt.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if start.month == 12:
        end = start.replace(year=start.year + 1, month=1)
    else:
        end = start.replace(month=start.month + 1)
    return start, end


def strip_id(d: dict) -> dict:
    if not d:
        return d
    d.pop("_id", None)
    return d


# ---------- Auth dependency ----------
async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(401, "Não autenticado")
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise HTTPException(401, "Token inválido")
        user = await db.users.find_one({"id": payload["sub"]})
        if not user:
            raise HTTPException(401, "Usuário não encontrado")
        user = strip_id(user)
        user.pop("password_hash", None)
        if payload.get("impersonated_by"):
            user["impersonated_by"] = payload["impersonated_by"]
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Sessão expirada")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Token inválido")


async def get_company(user: dict = Depends(get_current_user)) -> dict:
    company = await db.companies.find_one({"owner_id": user["id"]})
    if not company:
        raise HTTPException(400, "Empresa não configurada")
    return strip_id(company)


async def get_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") not in ("admin", "super_admin"):
        raise HTTPException(403, "Acesso negado")
    if user.get("blocked"):
        raise HTTPException(403, "Conta bloqueada")
    return user


async def get_super_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "super_admin":
        raise HTTPException(403, "Apenas SUPER_ADMIN")
    return user


# ---------- Audit ----------
async def audit(company_id: str, user_id: str, action: str, entity_type: str,
                entity_id: str, request: Optional[Request] = None, metadata: dict = None):
    await db.audit_logs.insert_one({
        "id": new_id(),
        "company_id": company_id,
        "user_id": user_id,
        "action": action,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "metadata": metadata or {},
        "ip": (request.client.host if request and request.client else None),
        "user_agent": (request.headers.get("user-agent") if request else None),
        "created_at": iso(now_utc()),
    })


# ---------- Models (request/response) ----------
class RegisterIn(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=6)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class ForgotIn(BaseModel):
    email: EmailStr


class ResetIn(BaseModel):
    token: str
    password: str = Field(min_length=6)


class CompanyIn(BaseModel):
    name: str
    legal_name: Optional[str] = ""
    document: Optional[str] = ""
    email: Optional[str] = ""
    phone: Optional[str] = ""
    address: Optional[str] = ""
    number: Optional[str] = ""
    complement: Optional[str] = ""
    neighborhood: Optional[str] = ""
    city: Optional[str] = ""
    state: Optional[str] = ""
    zip: Optional[str] = ""
    site: Optional[str] = ""
    logo: Optional[str] = ""  # base64 or URL
    brand_color: Optional[str] = "#00AD02"
    notes: Optional[str] = ""


class ClientIn(BaseModel):
    type: Literal["PF", "PJ"] = "PF"
    name: str
    document: Optional[str] = ""
    email: Optional[str] = ""
    phone: Optional[str] = ""
    address: Optional[str] = ""
    number: Optional[str] = ""
    complement: Optional[str] = ""
    neighborhood: Optional[str] = ""
    city: Optional[str] = ""
    state: Optional[str] = ""
    zip: Optional[str] = ""
    notes: Optional[str] = ""


class ProductIn(BaseModel):
    name: str
    sku: Optional[str] = ""
    description: Optional[str] = ""
    category: Optional[str] = ""
    unit: Optional[str] = "un"
    price: float = 0.0
    cost: Optional[float] = 0.0
    image: Optional[str] = ""
    notes: Optional[str] = ""


class ServiceIn(BaseModel):
    name: str
    description: Optional[str] = ""
    category: Optional[str] = ""
    unit: Optional[str] = "un"
    price: float = 0.0
    notes: Optional[str] = ""


class QuoteItemIn(BaseModel):
    item_type: Literal["product", "service", "custom"] = "custom"
    product_id: Optional[str] = None
    service_id: Optional[str] = None
    description: str
    quantity: float = 1.0
    unit: Optional[str] = "un"
    unit_price: float = 0.0


class QuoteIn(BaseModel):
    client_id: Optional[str] = None
    date: Optional[str] = None
    expiration_date: Optional[str] = None
    items: List[QuoteItemIn] = []
    discount: float = 0.0
    discount_type: Literal["value", "percent"] = "value"
    payment_method: Optional[str] = ""
    delivery_deadline: Optional[str] = ""
    notes: Optional[str] = ""
    terms: Optional[str] = ""
    orientation: Literal["vertical", "horizontal"] = "vertical"
    template_id: Optional[str] = None


class ReceiptIn(BaseModel):
    client_id: str
    quote_id: Optional[str] = None
    amount: float
    description: Optional[str] = ""
    payment_method: str = "PIX"
    payment_date: Optional[str] = None
    notes: Optional[str] = ""


class SignatureIn(BaseModel):
    signer_name: str
    signature_data: str  # base64 dataURL from canvas


# ---------- Startup ----------
@app.get("/health")
async def health():
    """Kubernetes liveness/readiness probe. Fast, no DB dependency so the
    container is marked healthy as soon as the process is accepting connections."""
    return {"status": "ok"}


@api.get("/health")
async def api_health():
    return {"status": "ok"}


async def _bootstrap_db():
    """Create indexes + seed admin lazily so any transient Atlas hiccup doesn't
    prevent uvicorn from binding to :8001 (which would cause Kubernetes probes
    to see Connection refused and kill the pod)."""
    try:
        await db.users.create_index("email", unique=True)
        await db.companies.create_index("owner_id", unique=True)
        await db.quotes.create_index([("company_id", 1), ("number", 1)], unique=True)
        await db.quotes.create_index("public_token", unique=True)
        await db.clients.create_index([("company_id", 1)])
        await db.products.create_index([("company_id", 1)])
        await db.services.create_index([("company_id", 1)])
        await db.quote_usage.create_index([("company_id", 1), ("billing_period_start", 1)])
        await db.stripe_webhook_events.create_index("stripe_event_id", unique=True)
        await db.payments.create_index([("user_id", 1), ("created_at", -1)])
        await db.payments.create_index("stripe_session_id")
        await db.users.create_index("stripe_customer_id", sparse=True)
        await db.support_tickets.create_index([("user_id", 1), ("updated_at", -1)])
        await db.support_tickets.create_index("number", unique=True)
        await db.support_tickets.create_index([("status", 1), ("updated_at", -1)])
        await db.support_messages.create_index([("ticket_id", 1), ("created_at", 1)])
    except Exception as e:
        logger.warning("Index bootstrap warning: %s", e)
    try:
        admin_email = os.environ.get("ADMIN_EMAIL", "admin@orcanext.com").lower()
        admin_pw = os.environ.get("ADMIN_PASSWORD", "Admin@2026")
        existing = await db.users.find_one({"email": admin_email})
        if not existing:
            await db.users.insert_one({
                "id": new_id(), "email": admin_email, "name": "OrçaNext Admin",
                "password_hash": hash_password(admin_pw), "role": "super_admin",
                "plan": "PROFESSIONAL", "created_at": iso(now_utc()),
            })
        elif not verify_password(admin_pw, existing["password_hash"]):
            await db.users.update_one({"email": admin_email},
                                       {"$set": {"password_hash": hash_password(admin_pw)}})
    except Exception as e:
        logger.warning("Admin seed warning: %s", e)


@app.on_event("startup")
async def startup():
    # Fire-and-forget so uvicorn starts listening on :8001 immediately.
    asyncio.create_task(_bootstrap_db())
    asyncio.create_task(followup_loop())
    logger.info("OrçaNext startup scheduled")


# ---------- Follow-up scheduler ----------
FOLLOWUP_DAYS = 3
FOLLOWUP_SECOND_DAYS = 7
FOLLOWUP_MAX = 2
FRONTEND_URL = os.environ.get("FRONTEND_URL", "https://invoice-pro-435.preview.emergentagent.com")


def _money_br(v):
    try:
        s = f"{float(v):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
        return f"R$ {s}"
    except Exception:
        return "R$ 0,00"


async def process_followups():
    now = now_utc()
    cutoff_3 = now - timedelta(days=FOLLOWUP_DAYS)
    # Quotes visualized but not approved/signed/expired, follow_up_enabled, not too many reminders
    async for q in db.quotes.find({
        "status": "VISUALIZADO",
        "follow_up_enabled": {"$ne": False},
    }):
        reminders_sent = q.get("reminders_sent", 0)
        if reminders_sent >= FOLLOWUP_MAX:
            continue
        # check last view or last reminder date
        last_reminder = q.get("last_reminder_at")
        anchor = last_reminder or q.get("updated_at") or q.get("created_at")
        try:
            anchor_dt = datetime.fromisoformat(anchor.replace("Z", "+00:00")) if isinstance(anchor, str) else anchor
        except Exception:
            continue
        days_needed = FOLLOWUP_SECOND_DAYS if reminders_sent >= 1 else FOLLOWUP_DAYS
        if (now - anchor_dt) < timedelta(days=days_needed):
            continue
        # skip expired
        if q.get("expiration_date") and q["expiration_date"] < now.date().isoformat():
            continue
        # global user setting
        company = await db.companies.find_one({"id": q["company_id"]})
        if not company:
            continue
        owner = await db.users.find_one({"id": company["owner_id"]})
        if not owner or owner.get("follow_up_enabled") is False:
            continue
        client = await db.clients.find_one({"id": q.get("client_id")}) if q.get("client_id") else None
        if not client or not client.get("email"):
            continue
        public_url = f"{FRONTEND_URL}/q/{q['public_token']}"
        html = build_followup_html(
            client_name=client["name"], company_name=company.get("name", "OrçaNext"),
            quote_number=q.get("number", ""), total_str=_money_br(q.get("total", 0)),
            public_url=public_url, reply_to=company.get("email"))
        subject = f"Lembrete: orçamento {q.get('number','')} de {company.get('name','')}"
        try:
            await send_email(to=client["email"], subject=subject, html=html,
                             reply_to=company.get("email"))
            await db.quotes.update_one({"id": q["id"]}, {"$set": {
                "last_reminder_at": iso(now),
            }, "$inc": {"reminders_sent": 1}})
            await db.followups.insert_one({
                "id": new_id(), "quote_id": q["id"], "company_id": q["company_id"],
                "client_email": client["email"], "sent_at": iso(now),
                "reminder_number": reminders_sent + 1,
            })
            logger.info(f"Follow-up sent for quote {q.get('number')} to {client['email']}")
        except Exception as e:
            logger.error(f"Follow-up failed for quote {q.get('id')}: {e}")


async def followup_loop():
    # Wait a bit for startup, then run every hour
    await asyncio.sleep(30)
    while True:
        try:
            await process_followups()
        except Exception as e:
            logger.error(f"Follow-up loop error: {e}")
        await asyncio.sleep(3600)


# ---------- Auth ----------
def set_auth_cookie(resp: Response, token: str):
    resp.set_cookie("access_token", token, httponly=True, secure=True,
                    samesite="none", max_age=7 * 24 * 3600, path="/")


@api.post("/auth/register")
async def register(payload: RegisterIn, response: Response):
    email = payload.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(400, "E-mail já cadastrado")
    uid = new_id()
    user = {
        "id": uid, "email": email, "name": payload.name,
        "password_hash": hash_password(payload.password),
        "role": "user", "plan": "FREE",
        "created_at": iso(now_utc()),
    }
    await db.users.insert_one(user)
    token = create_access_token(uid, email)
    set_auth_cookie(response, token)
    user.pop("password_hash", None)
    user.pop("_id", None)
    return {"user": user, "token": token}


@api.post("/auth/login")
async def login(payload: LoginIn, response: Response):
    email = payload.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(401, "E-mail ou senha inválidos")
    if user.get("blocked"):
        raise HTTPException(403, "Conta bloqueada. Contate o suporte.")
    token = create_access_token(user["id"], email)
    set_auth_cookie(response, token)
    strip_id(user)
    user.pop("password_hash", None)
    return {"user": user, "token": token}


@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    company = await db.companies.find_one({"owner_id": user["id"]})
    if company:
        strip_id(company)
    # Refresh plan from user
    return {"user": user, "company": company}


# ---------- Password reset (magic link) ----------
import hashlib


def _hash_token(t: str) -> str:
    return hashlib.sha256(t.encode()).hexdigest()


@api.post("/auth/forgot-password")
async def forgot_password(payload: ForgotIn, request: Request):
    email = payload.email.lower()
    user = await db.users.find_one({"email": email})
    # Always respond ok to avoid user enumeration
    if user:
        raw_token = secrets.token_urlsafe(32)
        token_hash = _hash_token(raw_token)
        expires = now_utc() + timedelta(hours=1)
        await db.password_resets.insert_one({
            "id": new_id(), "user_id": user["id"], "email": email,
            "token_hash": token_hash, "expires_at": iso(expires),
            "used": False, "created_at": iso(now_utc()),
            "ip": request.client.host if request.client else None,
        })
        reset_url = f"{FRONTEND_URL}/reset-password?token={raw_token}"
        subject = "Redefinir sua senha do OrçaNext"
        html = (
            '<table role="presentation" width="100%" style="background:#fafafa;padding:24px 0">'
            '<tr><td align="center">'
            '<table role="presentation" width="560" style="background:#fff;border:1px solid #e4e4e7;border-radius:12px;padding:32px;font-family:Arial,sans-serif;color:#18181b">'
            '<tr><td>'
            '<div style="font-size:12px;font-weight:700;letter-spacing:2px;color:#71717a;text-transform:uppercase">Redefinição de senha</div>'
            f'<h1 style="margin:8px 0 16px;font-size:24px;color:#000">Olá {user.get("name","")},</h1>'
            '<p style="margin:0 0 12px;line-height:1.6">Recebemos um pedido para redefinir a senha da sua conta no OrçaNext. Clique no botão abaixo para escolher uma nova senha. O link expira em 1 hora e pode ser usado apenas uma vez.</p>'
            f'<p style="margin:24px 0"><a href="{reset_url}" style="display:inline-block;background:#00AD02;color:#fff;text-decoration:none;font-weight:700;padding:12px 24px;border-radius:6px">REDEFINIR SENHA</a></p>'
            '<p style="margin:16px 0 0;font-size:12px;color:#71717a">Se você não solicitou esta redefinição, ignore este e-mail — sua senha permanece a mesma.</p>'
            '<p style="margin:16px 0 0;font-size:11px;color:#a1a1aa">OrçaNext nunca pede sua senha ou dados de cartão por e-mail.</p>'
            '</td></tr></table></td></tr></table>')
        try:
            await send_email(to=email, subject=subject, html=html)
        except Exception as e:
            logger.error(f"Password reset email failed: {e}")
    return {"ok": True, "message": "Se o e-mail existir, você receberá as instruções em instantes."}


@api.post("/auth/reset-password")
async def reset_password(payload: ResetIn, response: Response, request: Request):
    token_hash = _hash_token(payload.token)
    rec = await db.password_resets.find_one({"token_hash": token_hash, "used": False})
    if not rec:
        raise HTTPException(400, "Link inválido ou já utilizado")
    try:
        exp = datetime.fromisoformat(rec["expires_at"].replace("Z", "+00:00"))
    except Exception:
        exp = now_utc() - timedelta(seconds=1)
    if exp < now_utc():
        raise HTTPException(400, "Link expirado. Solicite um novo.")
    user = await db.users.find_one({"id": rec["user_id"]})
    if not user:
        raise HTTPException(400, "Usuário não encontrado")
    await db.users.update_one({"id": user["id"]}, {"$set": {
        "password_hash": hash_password(payload.password),
        "password_updated_at": iso(now_utc()),
    }})
    await db.password_resets.update_one({"id": rec["id"]}, {"$set": {
        "used": True, "used_at": iso(now_utc()),
    }})
    # Invalidate other pending resets for this user
    await db.password_resets.update_many({"user_id": user["id"], "used": False},
                                          {"$set": {"used": True, "used_at": iso(now_utc())}})
    # Auto-login
    token = create_access_token(user["id"], user["email"])
    set_auth_cookie(response, token)
    user.pop("password_hash", None); strip_id(user)
    await audit(user.get("id"), user["id"], "PASSWORD_RESET", "user", user["id"], request)
    return {"ok": True, "user": user, "token": token}


# ---------- Company / Onboarding ----------
@api.post("/company")
async def upsert_company(payload: CompanyIn, request: Request, user: dict = Depends(get_current_user)):
    existing = await db.companies.find_one({"owner_id": user["id"]})
    data = payload.model_dump()
    if existing:
        await db.companies.update_one({"owner_id": user["id"]},
                                       {"$set": {**data, "updated_at": iso(now_utc())}})
        await audit(existing["id"], user["id"], "COMPANY_UPDATED", "company", existing["id"], request)
        company = await db.companies.find_one({"owner_id": user["id"]})
    else:
        cid = new_id()
        doc = {"id": cid, "owner_id": user["id"], **data,
               "created_at": iso(now_utc()), "updated_at": iso(now_utc())}
        await db.companies.insert_one(doc)
        await audit(cid, user["id"], "COMPANY_CREATED", "company", cid, request)
        company = doc
    return strip_id(company)


@api.get("/company")
async def get_my_company(user: dict = Depends(get_current_user)):
    company = await db.companies.find_one({"owner_id": user["id"]})
    if not company:
        return None
    return strip_id(company)


# ---------- Onboarding checklist ----------
class OnboardingStateIn(BaseModel):
    skipped: Optional[bool] = None
    dismissed: Optional[bool] = None


@api.get("/onboarding/status")
async def onboarding_status(user: dict = Depends(get_current_user)):
    """Compute onboarding progress from real data (multi-tenant scoped by company_id).
    Uses cheap count_documents with a limit-like approach (existence check only)."""
    company = await db.companies.find_one({"owner_id": user["id"]})
    steps = {"company": False, "client": False, "product": False, "service": False, "quote": False}
    if company and (company.get("name") or "").strip():
        steps["company"] = True
        cid = company["id"]
        # Existence checks — cheap
        steps["client"]  = (await db.clients.count_documents({"company_id": cid}, limit=1)) > 0
        steps["product"] = (await db.products.count_documents({"company_id": cid}, limit=1)) > 0
        steps["service"] = (await db.services.count_documents({"company_id": cid}, limit=1)) > 0
        steps["quote"]   = (await db.quotes.count_documents({"company_id": cid}, limit=1)) > 0
    completed = sum([steps["company"], steps["client"], steps["product"] or steps["service"], steps["quote"]])
    return {
        "steps": steps,
        "completed_count": completed,
        "total": 4,
        "all_done": completed >= 4,
        "skipped": bool(user.get("onboarding_skipped")),
        "dismissed": bool(user.get("onboarding_dismissed")),
    }


@api.post("/onboarding/state")
async def onboarding_state(payload: OnboardingStateIn, user: dict = Depends(get_current_user)):
    update = {}
    if payload.skipped is not None:
        update["onboarding_skipped"] = bool(payload.skipped)
    if payload.dismissed is not None:
        update["onboarding_dismissed"] = bool(payload.dismissed)
    if update:
        await db.users.update_one({"id": user["id"]}, {"$set": update})
    return {"ok": True, **update}



# ---------- Clients ----------
@api.get("/clients")
async def list_clients(q: str = "", company: dict = Depends(get_company)):
    query = {"company_id": company["id"]}
    if q:
        rx = re.compile(re.escape(q), re.IGNORECASE)
        query["$or"] = [{"name": rx}, {"document": rx}, {"email": rx}]
    docs = await db.clients.find(query).sort("created_at", -1).to_list(1000)
    return [strip_id(d) for d in docs]


@api.post("/clients")
async def create_client(payload: ClientIn, request: Request,
                        user: dict = Depends(get_current_user),
                        company: dict = Depends(get_company)):
    cid = new_id()
    doc = {"id": cid, "company_id": company["id"], **payload.model_dump(),
           "created_at": iso(now_utc()), "updated_at": iso(now_utc())}
    await db.clients.insert_one(doc)
    await audit(company["id"], user["id"], "CLIENT_CREATED", "client", cid, request)
    return strip_id(doc)


@api.put("/clients/{cid}")
async def update_client(cid: str, payload: ClientIn, request: Request,
                        user: dict = Depends(get_current_user),
                        company: dict = Depends(get_company)):
    r = await db.clients.update_one({"id": cid, "company_id": company["id"]},
                                     {"$set": {**payload.model_dump(), "updated_at": iso(now_utc())}})
    if r.matched_count == 0:
        raise HTTPException(404, "Cliente não encontrado")
    await audit(company["id"], user["id"], "CLIENT_UPDATED", "client", cid, request)
    doc = await db.clients.find_one({"id": cid})
    return strip_id(doc)


@api.delete("/clients/{cid}")
async def delete_client(cid: str, request: Request,
                        user: dict = Depends(get_current_user),
                        company: dict = Depends(get_company)):
    r = await db.clients.delete_one({"id": cid, "company_id": company["id"]})
    if r.deleted_count == 0:
        raise HTTPException(404, "Cliente não encontrado")
    await audit(company["id"], user["id"], "CLIENT_DELETED", "client", cid, request)
    return {"ok": True}


# ---------- Products ----------
@api.get("/products")
async def list_products(q: str = "", company: dict = Depends(get_company)):
    query = {"company_id": company["id"]}
    if q:
        rx = re.compile(re.escape(q), re.IGNORECASE)
        query["$or"] = [{"name": rx}, {"sku": rx}, {"description": rx}]
    docs = await db.products.find(query).sort("name", 1).to_list(1000)
    return [strip_id(d) for d in docs]


@api.post("/products")
async def create_product(payload: ProductIn, request: Request,
                         user: dict = Depends(get_current_user),
                         company: dict = Depends(get_company)):
    pid = new_id()
    doc = {"id": pid, "company_id": company["id"], **payload.model_dump(),
           "created_at": iso(now_utc()), "updated_at": iso(now_utc())}
    await db.products.insert_one(doc)
    await audit(company["id"], user["id"], "PRODUCT_CREATED", "product", pid, request)
    return strip_id(doc)


@api.put("/products/{pid}")
async def update_product(pid: str, payload: ProductIn,
                         user: dict = Depends(get_current_user),
                         company: dict = Depends(get_company)):
    r = await db.products.update_one({"id": pid, "company_id": company["id"]},
                                      {"$set": {**payload.model_dump(), "updated_at": iso(now_utc())}})
    if r.matched_count == 0:
        raise HTTPException(404, "Produto não encontrado")
    doc = await db.products.find_one({"id": pid})
    return strip_id(doc)


@api.delete("/products/{pid}")
async def delete_product(pid: str, company: dict = Depends(get_company)):
    r = await db.products.delete_one({"id": pid, "company_id": company["id"]})
    if r.deleted_count == 0:
        raise HTTPException(404, "Produto não encontrado")
    return {"ok": True}


# ---------- Services ----------
@api.get("/services")
async def list_services(q: str = "", company: dict = Depends(get_company)):
    query = {"company_id": company["id"]}
    if q:
        rx = re.compile(re.escape(q), re.IGNORECASE)
        query["$or"] = [{"name": rx}, {"description": rx}]
    docs = await db.services.find(query).sort("name", 1).to_list(1000)
    return [strip_id(d) for d in docs]


@api.post("/services")
async def create_service(payload: ServiceIn,
                         user: dict = Depends(get_current_user),
                         company: dict = Depends(get_company)):
    sid = new_id()
    doc = {"id": sid, "company_id": company["id"], **payload.model_dump(),
           "created_at": iso(now_utc()), "updated_at": iso(now_utc())}
    await db.services.insert_one(doc)
    return strip_id(doc)


@api.put("/services/{sid}")
async def update_service(sid: str, payload: ServiceIn, company: dict = Depends(get_company)):
    r = await db.services.update_one({"id": sid, "company_id": company["id"]},
                                      {"$set": {**payload.model_dump(), "updated_at": iso(now_utc())}})
    if r.matched_count == 0:
        raise HTTPException(404, "Serviço não encontrado")
    doc = await db.services.find_one({"id": sid})
    return strip_id(doc)


@api.delete("/services/{sid}")
async def delete_service(sid: str, company: dict = Depends(get_company)):
    r = await db.services.delete_one({"id": sid, "company_id": company["id"]})
    if r.deleted_count == 0:
        raise HTTPException(404, "Serviço não encontrado")
    return {"ok": True}


# ---------- Quotes ----------
def calc_totals(items: List[dict], discount: float, discount_type: str) -> dict:
    subtotal = sum((it["quantity"] * it["unit_price"]) for it in items)
    if discount_type == "percent":
        disc_val = subtotal * (discount / 100.0)
    else:
        disc_val = discount
    total = max(0.0, subtotal - disc_val)
    return {"subtotal": round(subtotal, 2), "discount_value": round(disc_val, 2), "total": round(total, 2)}


async def get_usage_count(company_id: str) -> int:
    start, end = month_period()
    count = await db.quote_usage.count_documents({
        "company_id": company_id,
        "billing_period_start": iso(start),
        "event_type": "QUOTE_CREATED",
    })
    return count


async def next_quote_number(company_id: str) -> str:
    year = now_utc().year
    prefix = f"{year}-"
    latest = await db.quotes.find({"company_id": company_id, "number": {"$regex": f"^{prefix}"}})\
                            .sort("number", -1).limit(1).to_list(1)
    if latest:
        try:
            n = int(latest[0]["number"].split("-")[1]) + 1
        except Exception:
            n = 1
    else:
        n = 1
    return f"{prefix}{n:04d}"


async def get_free_limit() -> int:
    """Centralized read of the free plan monthly limit.
    Reads from platform_settings.free_limit, falls back to FREE_QUOTE_LIMIT env default (15)."""
    s = await db.platform_settings.find_one({"id": "main"}) or {}
    try:
        return int(s.get("free_limit") or FREE_QUOTE_LIMIT)
    except (TypeError, ValueError):
        return FREE_QUOTE_LIMIT


async def check_free_limit(user: dict, company: dict):
    if user.get("plan") == "PROFESSIONAL":
        return
    used = await get_usage_count(company["id"])
    limit = await get_free_limit()
    if used >= limit:
        raise HTTPException(402, f"Limite atingido: {used}/{limit} orçamentos deste mês. Faça upgrade para o Profissional.")


@api.get("/quotes/usage")
async def quotes_usage(user: dict = Depends(get_current_user), company: dict = Depends(get_company)):
    used = await get_usage_count(company["id"])
    start, end = month_period()
    limit = await get_free_limit()
    return {
        "used": used,
        "limit": limit if user.get("plan") != "PROFESSIONAL" else None,
        "plan": user.get("plan", "FREE"),
        "period_start": iso(start),
        "period_end": iso(end),
        "blocked": user.get("plan") != "PROFESSIONAL" and used >= limit,
    }


DASHBOARD_STATUSES = ["RASCUNHO", "ENVIADO", "VISUALIZADO", "AGUARDANDO_APROVACAO",
                       "APROVADO", "ASSINADO", "RECUSADO", "EXPIRADO", "CANCELADO"]
SENT_LIKE = {"ENVIADO", "VISUALIZADO", "AGUARDANDO_APROVACAO", "APROVADO", "ASSINADO"}
APPROVED_LIKE = {"APROVADO", "ASSINADO"}


@api.get("/dashboard/summary")
async def dashboard_summary(period: str = "30d", company: dict = Depends(get_company)):
    """Aggregate counts + value totals + conversion, scoped to this company only.
    Single aggregation, no per-card round-trip. Multi-tenant enforced by company_id filter."""
    now = now_utc()
    if period == "7d":
        since = now - timedelta(days=7)
    elif period == "30d":
        since = now - timedelta(days=30)
    elif period == "3m":
        since = now - timedelta(days=90)
    else:
        since = None  # all-time
    match = {"company_id": company["id"]}
    if since is not None:
        match["created_at"] = {"$gte": iso(since)}
    pipeline = [
        {"$match": match},
        {"$group": {
            "_id": "$status",
            "count": {"$sum": 1},
            "value": {"$sum": {"$ifNull": ["$total", 0]}},
        }},
    ]
    rows = await db.quotes.aggregate(pipeline).to_list(50)
    counts = {s: 0 for s in DASHBOARD_STATUSES}
    values = {s: 0.0 for s in DASHBOARD_STATUSES}
    for r in rows:
        s = r["_id"]
        if s in counts:
            counts[s] = r["count"]
            values[s] = float(r.get("value") or 0)
    total = sum(counts.values())
    sent_count = sum(counts[s] for s in SENT_LIKE)
    approved_count = sum(counts[s] for s in APPROVED_LIKE)
    value_sent = sum(values[s] for s in SENT_LIKE)
    value_approved = sum(values[s] for s in APPROVED_LIKE)
    conversion = round((approved_count / sent_count * 100), 1) if sent_count else 0.0
    return {
        "period": period,
        "total": total,
        "counts": counts,
        "sent_count": sent_count,
        "approved_count": approved_count,
        "value_sent": value_sent,
        "value_approved": value_approved,
        "conversion_rate": conversion,
    }


@api.get("/dashboard/timeseries")
async def dashboard_timeseries(period: str = "30d", company: dict = Depends(get_company)):
    """Return time-bucketed series of Enviados vs Aprovados for the dashboard chart.
    Multi-tenant enforced by company_id filter. Reuses existing quote docs; no schema change."""
    now = now_utc()
    if period == "7d":
        since = now - timedelta(days=7); bucket_len = 10   # yyyy-mm-dd
        step = timedelta(days=1); step_kind = "day"
    elif period == "30d":
        since = now - timedelta(days=30); bucket_len = 10
        step = timedelta(days=1); step_kind = "day"
    elif period == "3m":
        since = now - timedelta(days=90); bucket_len = 7   # yyyy-Www approximated via iso-week
        step = timedelta(days=7); step_kind = "week"
    else:
        since = None; bucket_len = 7                       # yyyy-mm
        step = None; step_kind = "month"

    match = {"company_id": company["id"]}
    if since is not None:
        match["created_at"] = {"$gte": iso(since)}
    # created_at is stored as ISO string; substring gives day/month prefix.
    group_expr = {"$substrBytes": ["$created_at", 0, bucket_len]}
    pipeline = [
        {"$match": match},
        {"$group": {
            "_id": {"b": group_expr, "s": "$status"},
            "count": {"$sum": 1},
        }},
    ]
    rows = await db.quotes.aggregate(pipeline).to_list(2000)
    buckets: dict[str, dict] = {}
    for r in rows:
        b = r["_id"]["b"]; s = r["_id"]["s"]; c = r["count"]
        slot = buckets.setdefault(b, {"enviados": 0, "aprovados": 0})
        if s in SENT_LIKE:
            slot["enviados"] += c
        if s in APPROVED_LIKE:
            slot["aprovados"] += c

    # Build the full timeline so the chart has no gaps.
    series = []
    if step_kind in ("day", "week"):
        cur = since
        while cur <= now:
            key = iso(cur)[:bucket_len]
            slot = buckets.get(key, {"enviados": 0, "aprovados": 0})
            series.append({"date": key, **slot})
            cur = cur + step
    else:
        # monthly: from earliest bucket to current month
        keys = sorted(buckets.keys())
        if not keys:
            cur_key = iso(now)[:7]
            series.append({"date": cur_key, "enviados": 0, "aprovados": 0})
        else:
            y, m = map(int, keys[0].split("-"))
            end_y, end_m = now.year, now.month
            while (y, m) <= (end_y, end_m):
                key = f"{y:04d}-{m:02d}"
                slot = buckets.get(key, {"enviados": 0, "aprovados": 0})
                series.append({"date": key, **slot})
                m += 1
                if m > 12:
                    m = 1; y += 1
    return {"period": period, "granularity": step_kind, "series": series}




@api.get("/quotes")
async def list_quotes(status: str = "", q: str = "", company: dict = Depends(get_company)):
    query = {"company_id": company["id"]}
    if status:
        query["status"] = status
    if q:
        rx = re.compile(re.escape(q), re.IGNORECASE)
        query["$or"] = [{"number": rx}, {"client_name": rx}]
    docs = await db.quotes.find(query).sort("created_at", -1).to_list(500)
    # auto-expire
    today = now_utc().date().isoformat()
    result = []
    for d in docs:
        strip_id(d)
        if d.get("expiration_date") and d["expiration_date"] < today and d["status"] in ("ENVIADO", "VISUALIZADO", "AGUARDANDO_APROVACAO"):
            d["status"] = "EXPIRADO"
            await db.quotes.update_one({"id": d["id"]}, {"$set": {"status": "EXPIRADO"}})
        result.append(d)
    return result


async def _build_quote_doc(payload: QuoteIn, company: dict) -> dict:
    items = []
    for it in payload.items:
        d = it.model_dump()
        d["total"] = round(d["quantity"] * d["unit_price"], 2)
        items.append(d)
    totals = calc_totals(items, payload.discount, payload.discount_type)
    client_name = ""
    if payload.client_id:
        cl = await db.clients.find_one({"id": payload.client_id, "company_id": company["id"]})
        client_name = cl["name"] if cl else ""
    return {"items": items, "totals": totals, "client_name": client_name}


@api.post("/quotes")
async def create_quote(payload: QuoteIn, request: Request,
                       user: dict = Depends(get_current_user),
                       company: dict = Depends(get_company)):
    await check_free_limit(user, company)
    built = await _build_quote_doc(payload, company)
    qid = new_id()
    number = await next_quote_number(company["id"])
    token = secrets.token_urlsafe(24)
    start, end = month_period()
    doc = {
        "id": qid,
        "company_id": company["id"],
        "client_id": payload.client_id,
        "client_name": built["client_name"],
        "number": number,
        "status": "RASCUNHO",
        "date": payload.date or now_utc().date().isoformat(),
        "expiration_date": payload.expiration_date,
        "items": built["items"],
        "subtotal": built["totals"]["subtotal"],
        "discount": payload.discount,
        "discount_type": payload.discount_type,
        "discount_value": built["totals"]["discount_value"],
        "total": built["totals"]["total"],
        "payment_method": payload.payment_method,
        "delivery_deadline": payload.delivery_deadline,
        "notes": payload.notes,
        "terms": payload.terms,
        "public_token": token,
        "orientation": payload.orientation,
        "template_id": payload.template_id,
        "views": [],
        "created_at": iso(now_utc()),
        "updated_at": iso(now_utc()),
    }
    await db.quotes.insert_one(doc)
    await db.quote_usage.insert_one({
        "id": new_id(), "company_id": company["id"], "quote_id": qid,
        "event_type": "QUOTE_CREATED",
        "billing_period_start": iso(start), "billing_period_end": iso(end),
        "created_at": iso(now_utc()),
    })
    await audit(company["id"], user["id"], "QUOTE_CREATED", "quote", qid, request)
    return strip_id(doc)


@api.get("/quotes/{qid}")
async def get_quote(qid: str, company: dict = Depends(get_company)):
    doc = await db.quotes.find_one({"id": qid, "company_id": company["id"]})
    if not doc:
        raise HTTPException(404, "Orçamento não encontrado")
    return strip_id(doc)


@api.put("/quotes/{qid}")
async def update_quote(qid: str, payload: QuoteIn, request: Request,
                       user: dict = Depends(get_current_user),
                       company: dict = Depends(get_company)):
    existing = await db.quotes.find_one({"id": qid, "company_id": company["id"]})
    if not existing:
        raise HTTPException(404, "Orçamento não encontrado")
    if existing["status"] in ("APROVADO", "ASSINADO"):
        raise HTTPException(400, "Não é possível editar orçamento aprovado/assinado")
    built = await _build_quote_doc(payload, company)
    update = {
        "client_id": payload.client_id,
        "client_name": built["client_name"],
        "date": payload.date or existing["date"],
        "expiration_date": payload.expiration_date,
        "items": built["items"],
        "subtotal": built["totals"]["subtotal"],
        "discount": payload.discount,
        "discount_type": payload.discount_type,
        "discount_value": built["totals"]["discount_value"],
        "total": built["totals"]["total"],
        "payment_method": payload.payment_method,
        "delivery_deadline": payload.delivery_deadline,
        "notes": payload.notes,
        "terms": payload.terms,
        "orientation": payload.orientation,
        "updated_at": iso(now_utc()),
    }
    await db.quotes.update_one({"id": qid}, {"$set": update})
    await audit(company["id"], user["id"], "QUOTE_UPDATED", "quote", qid, request)
    doc = await db.quotes.find_one({"id": qid})
    return strip_id(doc)


@api.post("/quotes/{qid}/status")
async def change_status(qid: str, body: dict, request: Request,
                        user: dict = Depends(get_current_user),
                        company: dict = Depends(get_company)):
    allowed = {"RASCUNHO", "ENVIADO", "CANCELADO"}
    new_status = body.get("status")
    if new_status not in allowed:
        raise HTTPException(400, "Status inválido")
    existing = await db.quotes.find_one({"id": qid, "company_id": company["id"]})
    if not existing:
        raise HTTPException(404, "Orçamento não encontrado")
    await db.quotes.update_one({"id": qid}, {"$set": {"status": new_status, "updated_at": iso(now_utc())}})
    await audit(company["id"], user["id"], f"QUOTE_STATUS_{new_status}", "quote", qid, request)
    return {"ok": True, "status": new_status}


@api.post("/quotes/{qid}/duplicate")
async def duplicate_quote(qid: str, request: Request,
                          user: dict = Depends(get_current_user),
                          company: dict = Depends(get_company)):
    await check_free_limit(user, company)
    src = await db.quotes.find_one({"id": qid, "company_id": company["id"]})
    if not src:
        raise HTTPException(404, "Orçamento não encontrado")
    new_qid = new_id()
    number = await next_quote_number(company["id"])
    token = secrets.token_urlsafe(24)
    start, end = month_period()
    doc = {**strip_id(dict(src)), "id": new_qid, "number": number,
           "public_token": token, "status": "RASCUNHO", "views": [],
           "date": now_utc().date().isoformat(),
           "created_at": iso(now_utc()), "updated_at": iso(now_utc())}
    await db.quotes.insert_one(doc)
    await db.quote_usage.insert_one({
        "id": new_id(), "company_id": company["id"], "quote_id": new_qid,
        "event_type": "QUOTE_CREATED",
        "billing_period_start": iso(start), "billing_period_end": iso(end),
        "created_at": iso(now_utc()),
    })
    await audit(company["id"], user["id"], "QUOTE_DUPLICATED", "quote", new_qid, request)
    return strip_id(doc)


@api.delete("/quotes/{qid}")
async def delete_quote(qid: str, request: Request,
                       user: dict = Depends(get_current_user),
                       company: dict = Depends(get_company)):
    r = await db.quotes.delete_one({"id": qid, "company_id": company["id"]})
    if r.deleted_count == 0:
        raise HTTPException(404, "Orçamento não encontrado")
    # Note: does NOT return usage credit (rule #26)
    await audit(company["id"], user["id"], "QUOTE_DELETED", "quote", qid, request)
    return {"ok": True}


@api.get("/quotes/{qid}/pdf")
async def quote_pdf(qid: str, user: dict = Depends(get_current_user),
                    company: dict = Depends(get_company)):
    quote = await db.quotes.find_one({"id": qid, "company_id": company["id"]})
    if not quote:
        raise HTTPException(404, "Orçamento não encontrado")
    strip_id(quote)
    client = None
    if quote.get("client_id"):
        client = await db.clients.find_one({"id": quote["client_id"]})
        if client:
            strip_id(client)
    signature = await db.signatures.find_one({"quote_id": qid})
    if signature:
        strip_id(signature)
    watermark = user.get("plan") != "PROFESSIONAL"
    pdf_bytes = build_quote_pdf(quote, company, client, signature, watermark)
    return StreamingResponse(io.BytesIO(pdf_bytes), media_type="application/pdf",
                              headers={"Content-Disposition": f"inline; filename=orcamento-{quote['number']}.pdf"})


# ---------- Public quote (no auth) ----------
@api.get("/public/quote/{token}")
async def public_quote(token: str, request: Request):
    quote = await db.quotes.find_one({"public_token": token})
    if not quote:
        raise HTTPException(404, "Orçamento não encontrado")
    strip_id(quote)
    # register view
    today = now_utc().date().isoformat()
    if quote.get("expiration_date") and quote["expiration_date"] < today and quote["status"] in ("ENVIADO", "VISUALIZADO"):
        quote["status"] = "EXPIRADO"
        await db.quotes.update_one({"id": quote["id"]}, {"$set": {"status": "EXPIRADO"}})
    else:
        if quote["status"] == "ENVIADO":
            await db.quotes.update_one({"id": quote["id"]},
                                        {"$set": {"status": "VISUALIZADO"}})
            quote["status"] = "VISUALIZADO"
        await db.quotes.update_one({"id": quote["id"]}, {"$push": {"views": {
            "at": iso(now_utc()),
            "ip": request.client.host if request.client else None,
            "user_agent": request.headers.get("user-agent"),
        }}})
    company = await db.companies.find_one({"id": quote["company_id"]})
    if company:
        strip_id(company)
        # Do not leak owner_id
        company.pop("owner_id", None)
    client = None
    if quote.get("client_id"):
        client = await db.clients.find_one({"id": quote["client_id"]})
        if client:
            strip_id(client)
    signature = await db.signatures.find_one({"quote_id": quote["id"]})
    if signature:
        strip_id(signature)
    owner = await db.users.find_one({"id": company["owner_id"]} if company and "owner_id" in company else {"id": "__none__"})
    is_pro = False
    if not owner:
        owner_user = await db.users.find_one({"id": (await db.companies.find_one({"id": quote["company_id"]})).get("owner_id")})
        is_pro = owner_user and owner_user.get("plan") == "PROFESSIONAL"
    return {"quote": quote, "company": company, "client": client, "signature": signature, "watermark": not is_pro}


@api.post("/public/quote/{token}/approve")
async def public_approve(token: str, request: Request):
    quote = await db.quotes.find_one({"public_token": token})
    if not quote:
        raise HTTPException(404, "Orçamento não encontrado")
    today = now_utc().date().isoformat()
    if quote.get("expiration_date") and quote["expiration_date"] < today:
        raise HTTPException(400, "Este orçamento expirou.")
    await db.quotes.update_one({"id": quote["id"]}, {"$set": {
        "status": "APROVADO", "approved_at": iso(now_utc()),
    }})
    await audit(quote["company_id"], "public", "QUOTE_APPROVED", "quote", quote["id"], request)
    return {"ok": True}


@api.post("/public/quote/{token}/sign")
async def public_sign(token: str, payload: SignatureIn, request: Request):
    quote = await db.quotes.find_one({"public_token": token})
    if not quote:
        raise HTTPException(404, "Orçamento não encontrado")
    today = now_utc().date().isoformat()
    if quote.get("expiration_date") and quote["expiration_date"] < today:
        raise HTTPException(400, "Este orçamento expirou.")
    sig = {
        "id": new_id(),
        "quote_id": quote["id"],
        "signer_name": payload.signer_name,
        "signature_data": payload.signature_data,
        "approved_at": quote.get("approved_at") or iso(now_utc()),
        "signed_at": iso(now_utc()),
        "ip": request.client.host if request.client else None,
        "user_agent": request.headers.get("user-agent"),
        "created_at": iso(now_utc()),
    }
    await db.signatures.replace_one({"quote_id": quote["id"]}, sig, upsert=True)
    await db.quotes.update_one({"id": quote["id"]}, {"$set": {"status": "ASSINADO"}})
    await audit(quote["company_id"], "public", "QUOTE_SIGNED", "quote", quote["id"], request)
    return {"ok": True}


@api.get("/public/quote/{token}/pdf")
async def public_pdf(token: str):
    quote = await db.quotes.find_one({"public_token": token})
    if not quote:
        raise HTTPException(404, "Orçamento não encontrado")
    strip_id(quote)
    company = await db.companies.find_one({"id": quote["company_id"]})
    if company:
        strip_id(company)
        owner_user = await db.users.find_one({"id": company.get("owner_id")})
        is_pro = owner_user and owner_user.get("plan") == "PROFESSIONAL"
        company.pop("owner_id", None)
    else:
        is_pro = False
    client = None
    if quote.get("client_id"):
        client = await db.clients.find_one({"id": quote["client_id"]})
        if client:
            strip_id(client)
    signature = await db.signatures.find_one({"quote_id": quote["id"]})
    if signature:
        strip_id(signature)
    pdf_bytes = build_quote_pdf(quote, company, client, signature, watermark=not is_pro)
    return StreamingResponse(io.BytesIO(pdf_bytes), media_type="application/pdf",
                              headers={"Content-Disposition": f"inline; filename=orcamento-{quote['number']}.pdf"})


# ---------- Receipts (Professional only) ----------
@api.get("/receipts")
async def list_receipts(user: dict = Depends(get_current_user), company: dict = Depends(get_company)):
    if user.get("plan") != "PROFESSIONAL":
        raise HTTPException(402, "Recibos disponíveis somente no plano Profissional")
    docs = await db.receipts.find({"company_id": company["id"]}).sort("created_at", -1).to_list(500)
    return [strip_id(d) for d in docs]


@api.post("/receipts")
async def create_receipt(payload: ReceiptIn, request: Request,
                         user: dict = Depends(get_current_user),
                         company: dict = Depends(get_company)):
    if user.get("plan") != "PROFESSIONAL":
        raise HTTPException(402, "Recibos disponíveis somente no plano Profissional")
    year = now_utc().year
    prefix = f"R-{year}-"
    latest = await db.receipts.find({"company_id": company["id"], "number": {"$regex": f"^{prefix}"}})\
                                .sort("number", -1).limit(1).to_list(1)
    if latest:
        try:
            n = int(latest[0]["number"].split("-")[2]) + 1
        except Exception:
            n = 1
    else:
        n = 1
    number = f"{prefix}{n:04d}"
    rid = new_id()
    doc = {"id": rid, "company_id": company["id"], "number": number, **payload.model_dump(),
           "payment_date": payload.payment_date or now_utc().date().isoformat(),
           "created_at": iso(now_utc())}
    await db.receipts.insert_one(doc)
    await audit(company["id"], user["id"], "RECEIPT_CREATED", "receipt", rid, request)
    return strip_id(doc)


@api.get("/receipts/{rid}/pdf")
async def receipt_pdf(rid: str, user: dict = Depends(get_current_user), company: dict = Depends(get_company)):
    if user.get("plan") != "PROFESSIONAL":
        raise HTTPException(402, "Recibos disponíveis somente no plano Profissional")
    receipt = await db.receipts.find_one({"id": rid, "company_id": company["id"]})
    if not receipt:
        raise HTTPException(404, "Recibo não encontrado")
    strip_id(receipt)
    client = await db.clients.find_one({"id": receipt["client_id"]})
    if client:
        strip_id(client)
    pdf = build_receipt_pdf(receipt, company, client)
    return StreamingResponse(io.BytesIO(pdf), media_type="application/pdf",
                              headers={"Content-Disposition": f"inline; filename=recibo-{receipt['number']}.pdf"})


# ---------- Plan / Billing ----------
@api.get("/plan")
async def get_plan(user: dict = Depends(get_current_user)):
    return {
        "plan": user.get("plan", "FREE"),
        "prices": {"monthly": PRO_MONTHLY_PRICE, "annual": PRO_ANNUAL_PRICE},
        "free_limit": await get_free_limit(),
        "billing": {
            "stripe_customer_id": user.get("stripe_customer_id"),
            "stripe_subscription_id": user.get("stripe_subscription_id"),
            "subscription_status": user.get("subscription_status"),
            "billing_cycle": user.get("billing_cycle"),
            "current_period_end": user.get("current_period_end"),
            "cancel_at_period_end": bool(user.get("cancel_at_period_end")),
        },
    }


@api.post("/plan/upgrade")
async def upgrade_plan_deprecated():
    """Deprecated mock endpoint. Real upgrades now go through Stripe Checkout.
    Kept only to return a 410 so any stale frontend code fails loudly instead of
    silently activating PRO."""
    raise HTTPException(410, "Endpoint descontinuado. Use /api/stripe/checkout para assinar o plano Profissional.")


@api.post("/plan/downgrade")
async def downgrade_plan(request: Request, user: dict = Depends(get_current_user)):
    """User-initiated downgrade. Cancels Stripe subscription at period end if any."""
    sub_id = user.get("stripe_subscription_id")
    if sub_id:
        try:
            stripe.Subscription.modify(sub_id, cancel_at_period_end=True)
        except stripe.error.StripeError as e:
            logger.warning("Stripe cancel failed: %s", e)
    await db.users.update_one({"id": user["id"]}, {"$set": {"cancel_at_period_end": True}})
    company = await db.companies.find_one({"owner_id": user["id"]})
    if company:
        await audit(company["id"], user["id"], "PLAN_DOWNGRADE_SCHEDULED", "user", user["id"], request,
                    metadata={"subscription_id": sub_id})
    # If they have no Stripe subscription (legacy demo users), downgrade immediately.
    if not sub_id:
        await db.users.update_one({"id": user["id"]}, {"$set": {"plan": "FREE"}})
        return {"ok": True, "plan": "FREE", "immediate": True}
    return {"ok": True, "cancel_at_period_end": True}


# ---------- Stripe billing ----------
class StripeCheckoutIn(BaseModel):
    billing_cycle: Literal["monthly", "yearly"] = "monthly"
    origin_url: str


@api.post("/stripe/checkout")
async def stripe_create_checkout(payload: StripeCheckoutIn, user: dict = Depends(get_current_user)):
    """Create a Stripe Checkout Session for a recurring subscription."""
    if not STRIPE_SECRET_KEY:
        raise HTTPException(503, "Billing indisponível: Stripe não configurado")
    # Prefer explicit LIVE Price IDs from env vars; fall back to lookup_key for
    # backwards compatibility with the earlier sandbox setup.
    explicit_price_id = STRIPE_MONTHLY_PRICE_ID if payload.billing_cycle == "monthly" else STRIPE_ANNUAL_PRICE_ID
    if explicit_price_id:
        try:
            price = stripe.Price.retrieve(explicit_price_id)
        except stripe.error.StripeError as e:
            raise HTTPException(500, f"Preço Stripe não encontrado ({explicit_price_id}): {e.user_message or 'erro'}")
    else:
        lookup = STRIPE_LOOKUP_MONTHLY if payload.billing_cycle == "monthly" else STRIPE_LOOKUP_YEARLY
        prices = stripe.Price.list(lookup_keys=[lookup], active=True, limit=1).data
        if not prices:
            raise HTTPException(500, f"Preço Stripe não encontrado: {lookup}")
        price = prices[0]

    # Reuse or create the Stripe Customer for this user
    customer_id = user.get("stripe_customer_id")
    if not customer_id:
        cust = stripe.Customer.create(
            email=user["email"], name=user.get("name"),
            metadata={"orcanext_user_id": user["id"]},
        )
        customer_id = cust.id
        await db.users.update_one({"id": user["id"]}, {"$set": {"stripe_customer_id": customer_id}})

    origin = payload.origin_url.rstrip("/")
    session = stripe.checkout.Session.create(
        mode="subscription",
        customer=customer_id,
        line_items=[{"price": price.id, "quantity": 1}],
        success_url=f"{origin}/billing/success?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{origin}/billing/cancel",
        allow_promotion_codes=True,
        metadata={
            "orcanext_user_id": user["id"],
            "billing_cycle": payload.billing_cycle,
            "price_id": price.id,
        },
        subscription_data={
            "metadata": {
                "orcanext_user_id": user["id"],
                "billing_cycle": payload.billing_cycle,
            },
        },
    )
    await db.payments.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "stripe_customer_id": customer_id,
        "stripe_session_id": session.id,
        "billing_cycle": payload.billing_cycle,
        "amount": (price.unit_amount or 0) / 100.0,
        "currency": price.currency,
        "status": "initiated",
        "payment_status": "pending",
        "created_at": iso(now_utc()),
        "updated_at": iso(now_utc()),
    })
    return {"checkout_url": session.url, "session_id": session.id}


@api.get("/stripe/status/{session_id}")
async def stripe_status(session_id: str, user: dict = Depends(get_current_user)):
    """Polled by the /billing/success page. Idempotent — same guard as webhook."""
    rec = await db.payments.find_one({"stripe_session_id": session_id, "user_id": user["id"]})
    if not rec:
        raise HTTPException(404, "Transação não encontrada")
    if rec.get("payment_status") != "paid" and STRIPE_SECRET_KEY:
        try:
            s = stripe.checkout.Session.retrieve(session_id)
            if s.status == "complete" and s.payment_status == "paid":
                # Fetch subscription and sync plan in-line (guarded to be idempotent).
                sub = stripe.Subscription.retrieve(s.subscription) if s.subscription else None
                await _apply_subscription_to_user(user["id"], sub)
                await db.payments.update_one(
                    {"stripe_session_id": session_id, "payment_status": {"$ne": "paid"}},
                    {"$set": {"status": "completed", "payment_status": "paid",
                              "stripe_subscription_id": s.subscription,
                              "updated_at": iso(now_utc())}},
                )
                rec = await db.payments.find_one({"stripe_session_id": session_id})
        except stripe.error.StripeError:
            pass
    fresh = await db.users.find_one({"id": user["id"]}, {"plan": 1, "_id": 0})
    return {
        "session_id": session_id,
        "status": rec.get("status"),
        "payment_status": rec.get("payment_status"),
        "plan": fresh.get("plan") if fresh else user.get("plan"),
    }


@api.post("/stripe/customer-portal")
async def stripe_customer_portal(payload: dict, user: dict = Depends(get_current_user)):
    """Create a Stripe Customer Portal session so the user can manage billing."""
    if not STRIPE_SECRET_KEY:
        raise HTTPException(503, "Billing indisponível")
    customer_id = user.get("stripe_customer_id")
    if not customer_id:
        raise HTTPException(400, "Nenhuma assinatura Stripe encontrada para esta conta")
    origin = (payload.get("origin_url") or "").rstrip("/") or "https://app.orcanext.com"
    session = stripe.billing_portal.Session.create(
        customer=customer_id, return_url=f"{origin}/dashboard/plan",
    )
    return {"portal_url": session.url}


async def _apply_subscription_to_user(user_id: str, sub) -> None:
    """Sync a Stripe Subscription object onto the OrçaNext user record.
    Active-like statuses grant PROFESSIONAL. Ended statuses drop back to FREE.
    Note: In recent Stripe API versions, `current_period_end` lives on the
    SubscriptionItem, not the Subscription — read both to stay compatible."""
    if not sub:
        return
    sub_dict = sub.to_dict() if hasattr(sub, "to_dict") else dict(sub)
    status = sub_dict.get("status")
    cancel_at_pe = bool(sub_dict.get("cancel_at_period_end"))
    period_end = sub_dict.get("current_period_end")
    price_id = None
    interval = None
    items_data = ((sub_dict.get("items") or {}).get("data") or [])
    if items_data:
        first = items_data[0]
        first_price = first.get("price") or {}
        price_id = first_price.get("id")
        interval = (first_price.get("recurring") or {}).get("interval")
        if not period_end:
            period_end = first.get("current_period_end")
    active_like = status in ("active", "trialing", "past_due")
    ended = status in ("canceled", "incomplete_expired", "unpaid")
    update = {
        "stripe_subscription_id": sub_dict.get("id"),
        "stripe_price_id": price_id,
        "subscription_status": status,
        "billing_cycle": "yearly" if interval == "year" else "monthly",
        "current_period_end": datetime.fromtimestamp(period_end, tz=timezone.utc).isoformat() if period_end else None,
        "cancel_at_period_end": cancel_at_pe,
        "updated_at": iso(now_utc()),
    }
    if active_like:
        update["plan"] = "PROFESSIONAL"
    elif ended:
        update["plan"] = "FREE"
    await db.users.update_one({"id": user_id}, {"$set": update})


@api.post("/stripe/webhook")
async def stripe_webhook(request: Request):
    """Stripe posts subscription lifecycle events here. Idempotent via
    stripe_webhook_events (unique index on stripe_event_id)."""
    if not STRIPE_WEBHOOK_SECRET:
        raise HTTPException(503, "Webhook não configurado")
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    try:
        event = stripe.Webhook.construct_event(payload, sig, STRIPE_WEBHOOK_SECRET)
    except stripe.error.SignatureVerificationError:
        raise HTTPException(400, "Assinatura inválida")
    except Exception as e:
        raise HTTPException(400, f"Payload inválido: {e}")

    event_id = event["id"]
    event_type = event["type"]
    # Idempotency: bail if we've already processed this event
    existing = await db.stripe_webhook_events.find_one({"stripe_event_id": event_id})
    if existing and existing.get("processed"):
        return {"received": True, "duplicate": True}
    await db.stripe_webhook_events.update_one(
        {"stripe_event_id": event_id},
        {"$setOnInsert": {
            "stripe_event_id": event_id, "event_type": event_type,
            "processed": False, "created_at": iso(now_utc()),
        }},
        upsert=True,
    )
    try:
        obj = event["data"]["object"]
        if event_type == "checkout.session.completed":
            user_id = (obj.get("metadata") or {}).get("orcanext_user_id")
            sub_id = obj.get("subscription")
            if user_id and sub_id:
                sub = stripe.Subscription.retrieve(sub_id)
                await _apply_subscription_to_user(user_id, sub)
            await db.payments.update_one(
                {"stripe_session_id": obj["id"]},
                {"$set": {"status": "completed", "payment_status": obj.get("payment_status", "paid"),
                          "stripe_subscription_id": sub_id, "updated_at": iso(now_utc())}},
            )
        elif event_type in ("customer.subscription.created", "customer.subscription.updated"):
            user_id = (obj.get("metadata") or {}).get("orcanext_user_id")
            if not user_id:
                # Fallback: look up user by customer id
                u = await db.users.find_one({"stripe_customer_id": obj.get("customer")})
                user_id = u["id"] if u else None
            if user_id:
                await _apply_subscription_to_user(user_id, obj)
        elif event_type == "customer.subscription.deleted":
            u = await db.users.find_one({"stripe_customer_id": obj.get("customer")})
            if u:
                await db.users.update_one({"id": u["id"]}, {"$set": {
                    "plan": "FREE", "subscription_status": "canceled",
                    "cancel_at_period_end": False, "updated_at": iso(now_utc()),
                }})
        elif event_type == "invoice.paid":
            u = await db.users.find_one({"stripe_customer_id": obj.get("customer")})
            if u:
                await db.payments.insert_one({
                    "id": str(uuid.uuid4()),
                    "user_id": u["id"],
                    "stripe_customer_id": obj.get("customer"),
                    "stripe_invoice_id": obj.get("id"),
                    "stripe_subscription_id": obj.get("subscription"),
                    "stripe_payment_intent_id": obj.get("payment_intent"),
                    "amount": (obj.get("amount_paid") or 0) / 100.0,
                    "currency": obj.get("currency"),
                    "status": "paid", "payment_status": "paid",
                    "payment_type": "invoice",
                    "paid_at": iso(now_utc()),
                    "created_at": iso(now_utc()),
                })
                # Ensure user is on PROFESSIONAL after successful invoice
                if obj.get("subscription"):
                    sub = stripe.Subscription.retrieve(obj["subscription"])
                    await _apply_subscription_to_user(u["id"], sub)
        elif event_type == "invoice.payment_failed":
            u = await db.users.find_one({"stripe_customer_id": obj.get("customer")})
            if u:
                await db.users.update_one({"id": u["id"]},
                    {"$set": {"subscription_status": "past_due", "updated_at": iso(now_utc())}})
        # other events (payment_intent.*, customer.created) are acknowledged but no-op
        await db.stripe_webhook_events.update_one(
            {"stripe_event_id": event_id},
            {"$set": {"processed": True, "processed_at": iso(now_utc())}},
        )
    except Exception as e:
        await db.stripe_webhook_events.update_one(
            {"stripe_event_id": event_id},
            {"$set": {"processing_error": str(e), "updated_at": iso(now_utc())}},
        )
        logger.exception("Stripe webhook processing failed: %s", event_type)
        raise HTTPException(500, "Webhook processing failed")
    return {"received": True}


# ---------- Support tickets ----------
SUPPORT_STATUSES = ["ABERTO", "EM_ATENDIMENTO", "AGUARDANDO_USUARIO", "RESOLVIDO", "FECHADO"]
SUPPORT_CATEGORIES = ["Dúvida", "Problema", "Pagamento", "Conta", "Orçamento", "Sugestão", "Outro"]
USER_REPLYABLE = {"ABERTO", "EM_ATENDIMENTO", "AGUARDANDO_USUARIO"}


class TicketIn(BaseModel):
    subject: str = Field(..., min_length=3, max_length=140)
    category: str
    message: str = Field(..., min_length=1, max_length=4000)


class TicketMessageIn(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)


class TicketStatusIn(BaseModel):
    status: Literal["ABERTO", "EM_ATENDIMENTO", "AGUARDANDO_USUARIO", "RESOLVIDO", "FECHADO"]


async def _next_ticket_number() -> int:
    """Sequential ticket number starting at 1024, atomic via findAndModify."""
    doc = await db.support_counters.find_one_and_update(
        {"id": "tickets"}, {"$inc": {"seq": 1}}, upsert=True, return_document=True,
    )
    seq = doc.get("seq") if doc else None
    if not seq:
        # First bump initializes seq=1; offset to start at 1024
        seq = 1
    return 1023 + int(seq)


def _sanitize_ticket(t: dict, unread_for: Optional[str] = None) -> dict:
    strip_id(t)
    if unread_for and t.get("last_read", {}).get(unread_for) != t.get("updated_at"):
        t["unread"] = True
    return t


@api.get("/support/categories")
async def support_categories(user: dict = Depends(get_current_user)):
    return {"categories": SUPPORT_CATEGORIES}


@api.post("/support/tickets")
async def create_ticket(payload: TicketIn, request: Request,
                         user: dict = Depends(get_current_user),
                         company: dict = Depends(get_company)):
    if payload.category not in SUPPORT_CATEGORIES:
        raise HTTPException(400, "Categoria inválida")
    now = iso(now_utc())
    tid = new_id()
    number = await _next_ticket_number()
    ticket = {
        "id": tid, "number": number,
        "user_id": user["id"], "company_id": company["id"],
        "user_email": user["email"], "user_name": user.get("name"),
        "company_name": company.get("name"),
        "subject": payload.subject.strip(),
        "category": payload.category,
        "status": "ABERTO",
        "created_at": now, "updated_at": now,
        "last_message_by": "USER",
    }
    await db.support_tickets.insert_one(ticket)
    await db.support_messages.insert_one({
        "id": new_id(), "ticket_id": tid,
        "sender_id": user["id"], "sender_type": "USER",
        "sender_name": user.get("name") or user["email"],
        "message": payload.message.strip(), "created_at": now,
    })
    await audit(company["id"], user["id"], "SUPPORT_TICKET_CREATED", "ticket", tid, request)
    return _sanitize_ticket(ticket)


@api.get("/support/tickets")
async def list_user_tickets(user: dict = Depends(get_current_user)):
    docs = await db.support_tickets.find({"user_id": user["id"]}).sort("updated_at", -1).to_list(500)
    return [_sanitize_ticket(d) for d in docs]


@api.get("/support/tickets/{tid}")
async def get_ticket(tid: str, user: dict = Depends(get_current_user)):
    t = await db.support_tickets.find_one({"id": tid})
    if not t:
        raise HTTPException(404, "Chamado não encontrado")
    is_admin = user.get("role") in ("admin", "super_admin")
    if not is_admin and t["user_id"] != user["id"]:
        raise HTTPException(403, "Acesso negado")
    msgs = await db.support_messages.find({"ticket_id": tid}).sort("created_at", 1).to_list(1000)
    for m in msgs:
        strip_id(m)
    return {"ticket": _sanitize_ticket(t), "messages": msgs}


@api.post("/support/tickets/{tid}/messages")
async def add_ticket_message(tid: str, payload: TicketMessageIn,
                              user: dict = Depends(get_current_user)):
    t = await db.support_tickets.find_one({"id": tid})
    if not t:
        raise HTTPException(404, "Chamado não encontrado")
    is_admin = user.get("role") in ("admin", "super_admin")
    if not is_admin and t["user_id"] != user["id"]:
        raise HTTPException(403, "Acesso negado")
    if t["status"] == "FECHADO":
        raise HTTPException(400, "Chamado fechado. Abra um novo chamado para continuar.")
    if not is_admin and t["status"] not in USER_REPLYABLE:
        raise HTTPException(400, "Não é possível responder este chamado")
    now = iso(now_utc())
    sender_type = "ADMIN" if is_admin else "USER"
    await db.support_messages.insert_one({
        "id": new_id(), "ticket_id": tid,
        "sender_id": user["id"], "sender_type": sender_type,
        "sender_name": user.get("name") or user["email"],
        "message": payload.message.strip(), "created_at": now,
    })
    # Auto-status transition: admin reply → AGUARDANDO_USUARIO; user reply → EM_ATENDIMENTO if it was AGUARDANDO_USUARIO
    new_status = t["status"]
    if is_admin and t["status"] in ("ABERTO", "EM_ATENDIMENTO"):
        new_status = "AGUARDANDO_USUARIO"
    elif not is_admin and t["status"] == "AGUARDANDO_USUARIO":
        new_status = "EM_ATENDIMENTO"
    await db.support_tickets.update_one({"id": tid}, {"$set": {
        "updated_at": now, "last_message_by": sender_type, "status": new_status,
    }})
    return {"ok": True, "status": new_status}


@api.put("/support/tickets/{tid}/status")
async def update_ticket_status(tid: str, payload: TicketStatusIn, request: Request,
                                admin: dict = Depends(get_admin)):
    t = await db.support_tickets.find_one({"id": tid})
    if not t:
        raise HTTPException(404, "Chamado não encontrado")
    now = iso(now_utc())
    await db.support_tickets.update_one({"id": tid},
        {"$set": {"status": payload.status, "updated_at": now}})
    await audit(t.get("company_id", "_platform_"), admin["id"], "SUPPORT_STATUS_CHANGED",
                "ticket", tid, request, metadata={"to": payload.status})
    return {"ok": True, "status": payload.status}


@api.get("/admin/support/tickets")
async def admin_list_tickets(status: str = "", admin: dict = Depends(get_admin)):
    query: dict = {}
    if status and status in SUPPORT_STATUSES:
        query["status"] = status
    docs = await db.support_tickets.find(query).sort("updated_at", -1).to_list(500)
    return [_sanitize_ticket(d) for d in docs]


@api.get("/admin/support/stats")
async def admin_support_stats(admin: dict = Depends(get_admin)):
    pipeline = [{"$group": {"_id": "$status", "count": {"$sum": 1}}}]
    rows = await db.support_tickets.aggregate(pipeline).to_list(20)
    stats = {s: 0 for s in SUPPORT_STATUSES}
    for r in rows:
        if r["_id"] in stats:
            stats[r["_id"]] = r["count"]
    stats["TOTAL"] = sum(stats[s] for s in SUPPORT_STATUSES)
    # Nova resposta do usuário aguardando atenção (pra badge no admin)
    stats["needs_admin"] = await db.support_tickets.count_documents({
        "status": {"$in": ["ABERTO", "EM_ATENDIMENTO"]},
        "last_message_by": "USER",
    })
    return stats


# ---------- Admin ----------
@api.get("/admin/metrics")
async def admin_metrics(admin: dict = Depends(get_admin)):
    total_users = await db.users.count_documents({})
    total_companies = await db.companies.count_documents({})
    total_quotes = await db.quotes.count_documents({})
    approved = await db.quotes.count_documents({"status": {"$in": ["APROVADO", "ASSINADO"]}})
    pro_users = await db.users.count_documents({"plan": "PROFESSIONAL"})
    mrr = pro_users * PRO_MONTHLY_PRICE
    return {
        "users": total_users, "companies": total_companies,
        "quotes": total_quotes, "quotes_approved": approved,
        "pro_users": pro_users, "mrr": round(mrr, 2), "arr": round(mrr * 12, 2),
        "conversion_rate": round((pro_users / total_users * 100) if total_users else 0, 2),
    }


@api.get("/admin/users")
async def admin_users(admin: dict = Depends(get_admin)):
    docs = await db.users.find({}, {"password_hash": 0}).sort("created_at", -1).to_list(500)
    return [strip_id(d) for d in docs]


@api.get("/admin/audit")
async def admin_audit(admin: dict = Depends(get_admin), limit: int = 100):
    docs = await db.audit_logs.find({}).sort("created_at", -1).limit(limit).to_list(limit)
    return [strip_id(d) for d in docs]


@api.get("/admin/companies")
async def admin_companies(admin: dict = Depends(get_admin)):
    docs = await db.companies.find({}).sort("created_at", -1).to_list(500)
    result = []
    for c in docs:
        strip_id(c)
        owner = await db.users.find_one({"id": c.get("owner_id")})
        c["owner_email"] = owner["email"] if owner else None
        c["owner_plan"] = owner["plan"] if owner else None
        c["blocked"] = bool(owner and owner.get("blocked"))
        c["quotes_count"] = await db.quotes.count_documents({"company_id": c["id"]})
        c["clients_count"] = await db.clients.count_documents({"company_id": c["id"]})
        result.append(c)
    return result


@api.get("/admin/quotes")
async def admin_all_quotes(admin: dict = Depends(get_admin), status: str = "", limit: int = 200):
    q = {"status": status} if status else {}
    docs = await db.quotes.find(q).sort("created_at", -1).limit(limit).to_list(limit)
    return [strip_id(d) for d in docs]


@api.post("/admin/users/{uid}/block")
async def admin_block(uid: str, body: dict, request: Request, admin: dict = Depends(get_admin)):
    blocked = bool(body.get("blocked", True))
    await db.users.update_one({"id": uid}, {"$set": {"blocked": blocked}})
    await audit("_platform_", admin["id"], "USER_BLOCKED" if blocked else "USER_UNBLOCKED",
                "user", uid, request, metadata={"reason": body.get("reason", "")})
    return {"ok": True, "blocked": blocked}


@api.post("/admin/users/{uid}/plan")
async def admin_set_plan(uid: str, body: dict, request: Request, admin: dict = Depends(get_admin)):
    plan = body.get("plan")
    if plan not in ("FREE", "PROFESSIONAL"):
        raise HTTPException(400, "Plano inválido")
    await db.users.update_one({"id": uid}, {"$set": {"plan": plan}})
    await audit("_platform_", admin["id"], "PLAN_CHANGED_BY_ADMIN", "user", uid, request,
                metadata={"to": plan})
    return {"ok": True, "plan": plan}


@api.get("/admin/near-limit")
async def admin_near_limit(admin: dict = Depends(get_admin)):
    start, end = month_period()
    limit = await get_free_limit()
    # "Near" threshold: 80% of the current free limit (rounded up), min 1.
    threshold = max(1, (limit * 4 + 4) // 5)
    pipeline = [
        {"$match": {"event_type": "QUOTE_CREATED", "billing_period_start": iso(start)}},
        {"$group": {"_id": "$company_id", "used": {"$sum": 1}}},
        {"$match": {"used": {"$gte": threshold}}},
        {"$sort": {"used": -1}},
    ]
    rows = await db.quote_usage.aggregate(pipeline).to_list(200)
    result = []
    for r in rows:
        comp = await db.companies.find_one({"id": r["_id"]})
        if not comp:
            continue
        owner = await db.users.find_one({"id": comp.get("owner_id")})
        if owner and owner.get("plan") == "PROFESSIONAL":
            continue
        result.append({"company_id": r["_id"], "company_name": comp.get("name"),
                        "used": r["used"], "limit": limit,
                        "user_email": owner["email"] if owner else None})
    return result


@api.get("/admin/settings")
async def admin_settings(admin: dict = Depends(get_admin)):
    s = await db.platform_settings.find_one({"id": "main"}) or {}
    return {"free_limit": s.get("free_limit", FREE_QUOTE_LIMIT),
            "pro_monthly": s.get("pro_monthly", PRO_MONTHLY_PRICE),
            "pro_annual": s.get("pro_annual", PRO_ANNUAL_PRICE),
            "support_email": s.get("support_email", "suporte@orcanext.com")}


@api.put("/admin/settings")
async def admin_update_settings(body: dict, request: Request, admin: dict = Depends(get_super_admin)):
    allowed = {k: v for k, v in body.items() if k in ("free_limit", "pro_monthly", "pro_annual", "support_email")}
    allowed["id"] = "main"; allowed["updated_at"] = iso(now_utc()); allowed["updated_by"] = admin["id"]
    await db.platform_settings.replace_one({"id": "main"}, allowed, upsert=True)
    await audit("_platform_", admin["id"], "SETTINGS_UPDATED", "platform", "main", request, metadata=allowed)
    return {"ok": True}


@api.post("/admin/impersonate/{uid}")
async def admin_impersonate(uid: str, response: Response, request: Request,
                             admin: dict = Depends(get_super_admin)):
    target = await db.users.find_one({"id": uid})
    if not target:
        raise HTTPException(404, "Usuário não encontrado")
    token = create_access_token(target["id"], target["email"], impersonated_by=admin["id"])
    set_auth_cookie(response, token)
    await audit("_platform_", admin["id"], "IMPERSONATE_START", "user", uid, request,
                metadata={"target_email": target["email"]})
    return {"ok": True, "impersonating": {"id": target["id"], "email": target["email"]}}


@api.post("/admin/impersonate-end")
async def admin_impersonate_end(response: Response, request: Request,
                                  user: dict = Depends(get_current_user)):
    admin_id = user.get("impersonated_by")
    if not admin_id:
        raise HTTPException(400, "Não está em modo impersonation")
    admin = await db.users.find_one({"id": admin_id})
    if not admin:
        raise HTTPException(404, "Admin original não encontrado")
    token = create_access_token(admin["id"], admin["email"])
    set_auth_cookie(response, token)
    await audit("_platform_", admin_id, "IMPERSONATE_END", "user", user["id"], request)
    return {"ok": True}


# ---------- Follow-up settings & manual send ----------
class FollowupSettingsIn(BaseModel):
    follow_up_enabled: bool


@api.get("/settings/followup")
async def get_followup_settings(user: dict = Depends(get_current_user)):
    return {"follow_up_enabled": user.get("follow_up_enabled", True),
            "days_first": FOLLOWUP_DAYS, "days_second": FOLLOWUP_SECOND_DAYS,
            "max_reminders": FOLLOWUP_MAX}


@api.put("/settings/followup")
async def set_followup_settings(payload: FollowupSettingsIn,
                                 user: dict = Depends(get_current_user)):
    await db.users.update_one({"id": user["id"]},
                               {"$set": {"follow_up_enabled": payload.follow_up_enabled}})
    return {"ok": True, "follow_up_enabled": payload.follow_up_enabled}


@api.post("/quotes/{qid}/followup-toggle")
async def toggle_quote_followup(qid: str, body: dict,
                                user: dict = Depends(get_current_user),
                                company: dict = Depends(get_company)):
    enabled = bool(body.get("enabled", True))
    r = await db.quotes.update_one({"id": qid, "company_id": company["id"]},
                                    {"$set": {"follow_up_enabled": enabled}})
    if r.matched_count == 0:
        raise HTTPException(404, "Orçamento não encontrado")
    return {"ok": True, "follow_up_enabled": enabled}


@api.post("/quotes/{qid}/send-followup-now")
async def send_followup_now(qid: str, user: dict = Depends(get_current_user),
                             company: dict = Depends(get_company)):
    q = await db.quotes.find_one({"id": qid, "company_id": company["id"]})
    if not q:
        raise HTTPException(404, "Orçamento não encontrado")
    if q.get("reminders_sent", 0) >= FOLLOWUP_MAX:
        raise HTTPException(400, "Limite de lembretes atingido para este orçamento")
    client = await db.clients.find_one({"id": q.get("client_id")}) if q.get("client_id") else None
    if not client or not client.get("email"):
        raise HTTPException(400, "Cliente sem e-mail cadastrado")
    public_url = f"{FRONTEND_URL}/q/{q['public_token']}"
    html = build_followup_html(client_name=client["name"], company_name=company.get("name", "OrçaNext"),
                                quote_number=q.get("number", ""), total_str=_money_br(q.get("total", 0)),
                                public_url=public_url, reply_to=company.get("email"))
    subject = f"Lembrete: orçamento {q.get('number','')} de {company.get('name','')}"
    try:
        await send_email(to=client["email"], subject=subject, html=html, reply_to=company.get("email"))
    except Exception as e:
        raise HTTPException(502, f"Falha ao enviar e-mail: {e}")
    await db.quotes.update_one({"id": qid}, {"$set": {"last_reminder_at": iso(now_utc())},
                                              "$inc": {"reminders_sent": 1}})
    await db.followups.insert_one({"id": new_id(), "quote_id": qid, "company_id": company["id"],
                                    "client_email": client["email"], "sent_at": iso(now_utc()),
                                    "reminder_number": q.get("reminders_sent", 0) + 1,
                                    "manual": True})
    return {"ok": True, "sent_to": client["email"]}


# ---------- Root ----------
@api.get("/")
async def root():
    return {"app": "OrçaNext", "slogan": "Crie. Envie. Aprove. Receba."}


# Mount router + CORS
app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown():
    client.close()
