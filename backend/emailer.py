"""Email sending via Emergent-managed Resend. Server-side templates only."""
import os
import re
import ipaddress
import logging
import httpx
from html import escape
from html.parser import HTMLParser
from urllib.parse import urlparse

logger = logging.getLogger("orcanext.email")
EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ.get("EMERGENT_EMAIL_KEY", "")
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME", "OrçaNext")
EMAIL_REPLY_TO = os.environ.get("EMAIL_REPLY_TO")

_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = ("reply with your password", "reply with the code", "send your password",
             "cvv", "seed phrase", "recovery phrase", "verify your card",
             "social security number", "confirm your bank details")
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)


def _host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host); return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)


def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)


class _Scan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []
    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []
    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)
    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []


def _assert_safe_email(subject: str, html: str) -> None:
    scan = _Scan(); scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms in email (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Credential ask: {p!r} (G2)")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Non-https link: {url!r} (G3)")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"Bad host: {url!r} (G3)")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor host mismatch (G3)")


async def send_email(*, to: str, subject: str, html: str, reply_to: str = None) -> str:
    if not EMAIL_KEY:
        raise RuntimeError("EMERGENT_EMAIL_KEY not configured")
    _assert_safe_email(subject, html)
    payload = {"to": [to], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME}
    if reply_to or EMAIL_REPLY_TO:
        payload["contact_email"] = reply_to or EMAIL_REPLY_TO
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(f"{EMAIL_BASE_URL}/api/v1/email/send",
                              headers={"X-Email-Key": EMAIL_KEY}, json=payload)
    r.raise_for_status()
    return r.json().get("id", "")


def build_followup_html(*, client_name: str, company_name: str, quote_number: str,
                         total_str: str, public_url: str, reply_to: str = None) -> str:
    return (
        '<table role="presentation" width="100%" style="background:#fafafa;padding:24px 0">'
        '<tr><td align="center">'
        '<table role="presentation" width="560" style="background:#fff;border:1px solid #e4e4e7;border-radius:12px;padding:32px;font-family:Arial,sans-serif;color:#18181b">'
        f'<tr><td><div style="font-size:12px;font-weight:700;letter-spacing:2px;color:#71717a;text-transform:uppercase">Lembrete de orçamento</div>'
        f'<h1 style="margin:8px 0 16px;font-size:24px;color:#000">Olá {escape(client_name)},</h1>'
        f'<p style="margin:0 0 12px;line-height:1.6">Notamos que você visualizou o orçamento <b>{escape(quote_number)}</b> enviado por <b>{escape(company_name)}</b>, no valor de <b>{escape(total_str)}</b>, mas ainda não recebemos sua resposta.</p>'
        '<p style="margin:0 0 20px;line-height:1.6">Se ainda tem interesse, é só clicar abaixo para revisar e aprovar:</p>'
        f'<p style="margin:24px 0"><a href="{escape(public_url)}" style="display:inline-block;background:#00AD02;color:#fff;text-decoration:none;font-weight:700;padding:12px 24px;border-radius:6px">VER ORÇAMENTO</a></p>'
        '<p style="margin:16px 0 0;font-size:12px;color:#71717a">Se preferir não receber mais lembretes deste orçamento, basta ignorar esta mensagem.</p>'
        f'<p style="margin:16px 0 0;font-size:11px;color:#a1a1aa">Enviado por {escape(EMAIL_FROM_NAME)} em nome de {escape(company_name)}. Nunca pedimos senha ou dados de cartão por e-mail.</p>'
        '</td></tr></table></td></tr></table>')
