"""PDF generation for OrçaNext using ReportLab."""
import io
import base64
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table,
                                 TableStyle, Image, PageBreak)
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER

GREEN = colors.HexColor("#00AD02")
BLACK = colors.HexColor("#000000")
GRAY = colors.HexColor("#71717a")
LIGHT = colors.HexColor("#f4f4f5")
BORDER = colors.HexColor("#e4e4e7")


def _money(v):
    try:
        return f"R$ {float(v):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    except Exception:
        return "R$ 0,00"


def _decode_image(data_url: str):
    if not data_url:
        return None
    try:
        if data_url.startswith("data:"):
            data_url = data_url.split(",", 1)[1]
        raw = base64.b64decode(data_url)
        return io.BytesIO(raw)
    except Exception:
        return None


def _watermark(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica-Bold", 8)
    canvas.setFillColor(GRAY)
    canvas.drawRightString(A4[0] - 1.5 * cm, 1 * cm, "Criado com OrçaNext")
    canvas.restoreState()


def _no_watermark(canvas, doc):
    pass


def build_quote_pdf(quote: dict, company: dict, client: dict,
                    signature: dict, watermark: bool = True) -> bytes:
    buf = io.BytesIO()
    orientation = quote.get("orientation", "vertical")
    pagesize = landscape(A4) if orientation == "horizontal" else A4
    doc = SimpleDocTemplate(buf, pagesize=pagesize,
                             leftMargin=1.5 * cm, rightMargin=1.5 * cm,
                             topMargin=1.5 * cm, bottomMargin=2 * cm)
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="H1", fontName="Helvetica-Bold", fontSize=22,
                              textColor=BLACK, spaceAfter=6))
    styles.add(ParagraphStyle(name="H2", fontName="Helvetica-Bold", fontSize=12,
                              textColor=BLACK, spaceAfter=4))
    styles.add(ParagraphStyle(name="Small", fontName="Helvetica", fontSize=9,
                              textColor=GRAY))
    styles.add(ParagraphStyle(name="Body2", fontName="Helvetica", fontSize=10,
                              textColor=BLACK))
    styles.add(ParagraphStyle(name="Right", fontName="Helvetica-Bold", fontSize=11,
                              textColor=BLACK, alignment=TA_RIGHT))

    story = []
    # Header: logo + company + quote title
    company = company or {}
    logo_io = _decode_image(company.get("logo") or "")
    header_left = []
    if logo_io:
        try:
            img = Image(logo_io, width=3.5 * cm, height=3.5 * cm, kind="proportional")
            header_left.append(img)
        except Exception:
            pass
    company_info = f"<b>{company.get('name','Sua Empresa')}</b><br/>"
    if company.get("legal_name"):
        company_info += f"{company['legal_name']}<br/>"
    if company.get("document"):
        company_info += f"CNPJ/CPF: {company['document']}<br/>"
    if company.get("email"):
        company_info += f"{company['email']}<br/>"
    if company.get("phone"):
        company_info += f"{company['phone']}<br/>"
    addr = company.get("address", "")
    if addr:
        company_info += f"{addr}"
    header_left.append(Paragraph(company_info, styles["Body2"]))

    header_right = [
        Paragraph("<b>ORÇAMENTO</b>", styles["H1"]),
        Paragraph(f"Nº <b>{quote.get('number','')}</b>", styles["Body2"]),
        Paragraph(f"Data: {quote.get('date','')}", styles["Small"]),
        Paragraph(f"Validade: {quote.get('expiration_date','—')}", styles["Small"]),
        Paragraph(f"Status: <b>{quote.get('status','')}</b>", styles["Small"]),
    ]
    header = Table([[header_left, header_right]],
                   colWidths=[doc.width * 0.6, doc.width * 0.4])
    header.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
    ]))
    story.append(header)
    story.append(Spacer(1, 12))
    story.append(Table([[""]], colWidths=[doc.width], rowHeights=[2],
                        style=TableStyle([("BACKGROUND", (0, 0), (-1, -1), GREEN)])))
    story.append(Spacer(1, 12))

    # Client
    client = client or {}
    story.append(Paragraph("CLIENTE", styles["H2"]))
    client_info = f"<b>{client.get('name','—')}</b><br/>"
    if client.get("document"):
        client_info += f"Documento: {client['document']}<br/>"
    if client.get("email"):
        client_info += f"{client['email']}<br/>"
    if client.get("phone"):
        client_info += f"{client['phone']}<br/>"
    if client.get("address"):
        client_info += client["address"]
    story.append(Paragraph(client_info, styles["Body2"]))
    story.append(Spacer(1, 14))

    # Items
    data = [["#", "Descrição", "Qtd", "Un.", "Vlr. Unit.", "Total"]]
    for i, it in enumerate(quote.get("items", []), 1):
        data.append([
            str(i),
            Paragraph(it.get("description", ""), styles["Body2"]),
            f"{it.get('quantity',0):g}",
            it.get("unit", ""),
            _money(it.get("unit_price", 0)),
            _money(it.get("total", 0)),
        ])
    col_widths = [1 * cm, doc.width - (1 + 1.6 + 1.6 + 2.4 + 2.6) * cm,
                  1.6 * cm, 1.6 * cm, 2.4 * cm, 2.6 * cm]
    table = Table(data, colWidths=col_widths, repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), BLACK),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("FONTSIZE", (0, 1), (-1, -1), 9),
        ("ALIGN", (2, 1), (-1, -1), "RIGHT"),
        ("ALIGN", (3, 1), (3, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT]),
        ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, BORDER),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(table)
    story.append(Spacer(1, 12))

    # Totals
    totals_data = [
        ["Subtotal", _money(quote.get("subtotal", 0))],
        [f"Desconto{' (%)' if quote.get('discount_type')=='percent' else ''}",
         f"- {_money(quote.get('discount_value', 0))}"],
        ["TOTAL", _money(quote.get("total", 0))],
    ]
    tt = Table(totals_data, colWidths=[4 * cm, 4 * cm], hAlign="RIGHT")
    tt.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -2), "Helvetica"),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("FONTSIZE", (0, -1), (-1, -1), 13),
        ("TEXTCOLOR", (0, -1), (-1, -1), GREEN),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("LINEABOVE", (0, -1), (-1, -1), 0.5, BORDER),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(tt)
    story.append(Spacer(1, 14))

    # Payment / delivery
    if quote.get("payment_method") or quote.get("delivery_deadline"):
        info = ""
        if quote.get("payment_method"):
            info += f"<b>Forma de pagamento:</b> {quote['payment_method']}<br/>"
        if quote.get("delivery_deadline"):
            info += f"<b>Prazo:</b> {quote['delivery_deadline']}"
        story.append(Paragraph(info, styles["Body2"]))
        story.append(Spacer(1, 8))

    if quote.get("notes"):
        story.append(Paragraph("<b>Observações</b>", styles["H2"]))
        story.append(Paragraph(quote["notes"].replace("\n", "<br/>"), styles["Body2"]))
        story.append(Spacer(1, 8))

    if quote.get("terms"):
        story.append(Paragraph("<b>Termos e condições</b>", styles["H2"]))
        story.append(Paragraph(quote["terms"].replace("\n", "<br/>"), styles["Body2"]))
        story.append(Spacer(1, 10))

    # Signature
    if signature and signature.get("signature_data"):
        story.append(Spacer(1, 10))
        story.append(Paragraph("<b>ACEITE ELETRÔNICO</b>", styles["H2"]))
        sig_io = _decode_image(signature["signature_data"])
        if sig_io:
            try:
                story.append(Image(sig_io, width=6 * cm, height=2.5 * cm, kind="proportional"))
            except Exception:
                pass
        story.append(Paragraph(
            f"Assinado por: <b>{signature.get('signer_name','')}</b><br/>"
            f"Data/Hora: {signature.get('signed_at','')}<br/>"
            f"IP: {signature.get('ip','—')}",
            styles["Small"]))

    doc.build(story, onFirstPage=(_watermark if watermark else _no_watermark),
              onLaterPages=(_watermark if watermark else _no_watermark))
    return buf.getvalue()


def build_receipt_pdf(receipt: dict, company: dict, client: dict) -> bytes:
    """Premium A4 receipt layout — clean, minimal, brand-aligned."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=1.8 * cm, rightMargin=1.8 * cm,
        topMargin=1.8 * cm, bottomMargin=2 * cm,
    )
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="RcpEyebrow", fontName="Helvetica-Bold", fontSize=8,
                              textColor=GRAY, spaceAfter=4, leading=10))
    styles.add(ParagraphStyle(name="RcpTitle", fontName="Helvetica-Bold", fontSize=24,
                              textColor=BLACK, alignment=TA_RIGHT, spaceAfter=4, leading=26))
    styles.add(ParagraphStyle(name="RcpMeta", fontName="Helvetica", fontSize=10,
                              textColor=BLACK, alignment=TA_RIGHT, spaceAfter=2, leading=13))
    styles.add(ParagraphStyle(name="RcpBody", fontName="Helvetica", fontSize=10,
                              textColor=BLACK, leading=14, spaceAfter=4))
    styles.add(ParagraphStyle(name="RcpSmall", fontName="Helvetica", fontSize=8.5,
                              textColor=GRAY, leading=11))
    styles.add(ParagraphStyle(name="RcpCompanyName", fontName="Helvetica-Bold", fontSize=13,
                              textColor=BLACK, leading=15, spaceAfter=2))
    styles.add(ParagraphStyle(name="RcpAmount", fontName="Helvetica-Bold", fontSize=32,
                              textColor=GREEN, alignment=TA_LEFT, leading=34))
    styles.add(ParagraphStyle(name="RcpAmountLabel", fontName="Helvetica-Bold", fontSize=8.5,
                              textColor=GRAY, alignment=TA_LEFT, spaceAfter=4, leading=10))
    styles.add(ParagraphStyle(name="RcpPartyLabel", fontName="Helvetica-Bold", fontSize=8,
                              textColor=GRAY, spaceAfter=4, leading=10))
    styles.add(ParagraphStyle(name="RcpFooter", fontName="Helvetica", fontSize=8,
                              textColor=GRAY, alignment=TA_CENTER, leading=10))

    story = []
    company = company or {}
    client = client or {}
    amount_str = _money(receipt.get("amount", 0))

    # ---------- Header: company (left) + title/meta (right) ----------
    company_lines = [f"<b>{company.get('name','—')}</b>"]
    if company.get("document"):
        company_lines.append(f"CNPJ/CPF: {company['document']}")
    if company.get("email"):
        company_lines.append(company["email"])
    if company.get("phone"):
        company_lines.append(company["phone"])
    if company.get("address"):
        company_lines.append(company["address"])
    header_left = [
        Paragraph("EMITIDO POR", styles["RcpEyebrow"]),
        Paragraph("<br/>".join(company_lines), styles["RcpBody"]),
    ]
    header_right = [
        Paragraph("RECIBO DE PAGAMENTO", styles["RcpTitle"]),
        Paragraph(f"Nº <b>{receipt.get('number','—')}</b>", styles["RcpMeta"]),
        Paragraph(f"Data: <b>{receipt.get('payment_date','—')}</b>", styles["RcpMeta"]),
    ]
    header = Table([[header_left, header_right]],
                   colWidths=[doc.width * 0.55, doc.width * 0.45])
    header.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(header)
    story.append(Spacer(1, 10))

    # Brand accent bar
    story.append(Table([[""]], colWidths=[doc.width], rowHeights=[3],
                        style=TableStyle([
                            ("BACKGROUND", (0, 0), (-1, -1), GREEN),
                            ("LINEBELOW", (0, 0), (-1, -1), 0, colors.white),
                        ])))
    story.append(Spacer(1, 18))

    # ---------- Hero: valor recebido ----------
    hero_left = [
        Paragraph("VALOR RECEBIDO", styles["RcpAmountLabel"]),
        Paragraph(amount_str, styles["RcpAmount"]),
    ]
    hero_right = [
        Paragraph("FORMA DE PAGAMENTO", styles["RcpPartyLabel"]),
        Paragraph(f"<b>{(receipt.get('payment_method') or '—').upper()}</b>", styles["RcpBody"]),
    ]
    hero = Table([[hero_left, hero_right]],
                 colWidths=[doc.width * 0.62, doc.width * 0.38])
    hero.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.white),
        ("BOX", (0, 0), (-1, -1), 0.6, BORDER),
        ("LINEBEFORE", (0, 0), (0, -1), 3, GREEN),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("VALIGN", (1, 0), (1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (0, -1), 16),
        ("RIGHTPADDING", (0, 0), (0, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 14),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
        ("LEFTPADDING", (1, 0), (1, -1), 12),
    ]))
    story.append(hero)
    story.append(Spacer(1, 18))

    # ---------- Corpo descritivo ----------
    story.append(Paragraph(
        f"Recebi(emos) de <b>{client.get('name','—')}</b>"
        + (f", inscrito(a) sob {client.get('document')}" if client.get("document") else "")
        + f", a importância de <b>{amount_str}</b>, referente a "
        f"<b>{receipt.get('description') or '—'}</b>, pago via "
        f"<b>{(receipt.get('payment_method') or '—').upper()}</b> em "
        f"<b>{receipt.get('payment_date','—')}</b>. "
        "Para clareza, firmo o presente recibo dando plena, geral e irrevogável quitação "
        "para nada mais reclamar em tempo algum.",
        styles["RcpBody"]))
    story.append(Spacer(1, 18))

    # ---------- Parties: RECEBIDO DE / PAGO A ----------
    def _party_cell(label, lines):
        return [
            Paragraph(label, styles["RcpPartyLabel"]),
            Paragraph("<br/>".join(lines), styles["RcpBody"]),
        ]
    client_lines = [f"<b>{client.get('name','—')}</b>"]
    if client.get("document"):
        client_lines.append(f"CPF/CNPJ: {client['document']}")
    if client.get("email"):
        client_lines.append(client["email"])
    if client.get("phone"):
        client_lines.append(client["phone"])
    if client.get("address"):
        client_lines.append(client["address"])
    payee_lines = [f"<b>{company.get('name','—')}</b>"]
    if company.get("document"):
        payee_lines.append(f"CNPJ/CPF: {company['document']}")
    if company.get("email"):
        payee_lines.append(company["email"])
    if company.get("phone"):
        payee_lines.append(company["phone"])

    parties = Table([[
        _party_cell("PAGO POR", client_lines),
        _party_cell("RECEBIDO POR", payee_lines),
    ]], colWidths=[doc.width / 2, doc.width / 2])
    parties.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BACKGROUND", (0, 0), (-1, -1), LIGHT),
        ("BOX", (0, 0), (-1, -1), 0.4, BORDER),
        ("LINEAFTER", (0, 0), (0, -1), 0.4, BORDER),
        ("LEFTPADDING", (0, 0), (-1, -1), 14),
        ("RIGHTPADDING", (0, 0), (-1, -1), 14),
        ("TOPPADDING", (0, 0), (-1, -1), 12),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
    ]))
    story.append(parties)
    story.append(Spacer(1, 18))

    # ---------- Observações (opcional) ----------
    if receipt.get("notes"):
        notes_cell = [
            Paragraph("OBSERVAÇÕES", styles["RcpPartyLabel"]),
            Paragraph(receipt["notes"], styles["RcpBody"]),
        ]
        notes = Table([[notes_cell]], colWidths=[doc.width])
        notes.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.white),
            ("BOX", (0, 0), (-1, -1), 0.4, BORDER),
            ("LEFTPADDING", (0, 0), (-1, -1), 14),
            ("RIGHTPADDING", (0, 0), (-1, -1), 14),
            ("TOPPADDING", (0, 0), (-1, -1), 12),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
        ]))
        story.append(notes)
        story.append(Spacer(1, 18))

    # ---------- Local / Assinatura ----------
    story.append(Spacer(1, 24))
    sig_line = Table([[""]], colWidths=[doc.width * 0.55], rowHeights=[0.6])
    sig_line.setStyle(TableStyle([("LINEABOVE", (0, 0), (-1, -1), 0.8, BLACK)]))
    sig_block = [
        sig_line,
        Paragraph(f"<b>{company.get('name','—')}</b>", styles["RcpBody"]),
        Paragraph(
            (f"CNPJ/CPF: {company['document']}" if company.get("document") else "&nbsp;"),
            styles["RcpSmall"]),
        Paragraph("Assinatura do emitente", styles["RcpSmall"]),
    ]
    sig_wrap = Table([[sig_block]], colWidths=[doc.width * 0.55])
    sig_wrap.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
    ]))
    holder = Table([["", sig_wrap]],
                   colWidths=[doc.width * 0.45, doc.width * 0.55])
    holder.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(holder)

    # ---------- Footer ----------
    def _footer(canvas, doc_):
        canvas.saveState()
        canvas.setStrokeColor(BORDER)
        canvas.setLineWidth(0.4)
        canvas.line(1.8 * cm, 1.6 * cm, A4[0] - 1.8 * cm, 1.6 * cm)
        canvas.setFont("Helvetica-Bold", 8)
        canvas.setFillColor(GREEN)
        canvas.drawString(1.8 * cm, 1 * cm, "OrçaNext")
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(GRAY)
        canvas.drawString(3.05 * cm, 1 * cm, "· Recibo emitido eletronicamente · Crie. Envie. Aprove. Receba.")
        canvas.drawRightString(A4[0] - 1.8 * cm, 1 * cm, f"Recibo Nº {receipt.get('number','—')}")
        canvas.restoreState()

    doc.build(story, onFirstPage=_footer, onLaterPages=_footer)
    return buf.getvalue()
