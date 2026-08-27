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
    """Premium A4 quote layout — matching receipt aesthetics, table with
    repeatRows so pagination stays clean when there are many items."""
    buf = io.BytesIO()
    orientation = quote.get("orientation", "vertical")
    pagesize = landscape(A4) if orientation == "horizontal" else A4
    doc = SimpleDocTemplate(
        buf, pagesize=pagesize,
        leftMargin=1.8 * cm, rightMargin=1.8 * cm,
        topMargin=1.8 * cm, bottomMargin=2 * cm,
    )
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="QEyebrow", fontName="Helvetica-Bold", fontSize=8,
                              textColor=GRAY, spaceAfter=4, leading=10))
    styles.add(ParagraphStyle(name="QTitle", fontName="Helvetica-Bold", fontSize=24,
                              textColor=BLACK, alignment=TA_RIGHT, spaceAfter=4, leading=26))
    styles.add(ParagraphStyle(name="QMeta", fontName="Helvetica", fontSize=10,
                              textColor=BLACK, alignment=TA_RIGHT, spaceAfter=2, leading=13))
    styles.add(ParagraphStyle(name="QBody", fontName="Helvetica", fontSize=10,
                              textColor=BLACK, leading=14, spaceAfter=4))
    styles.add(ParagraphStyle(name="QSmall", fontName="Helvetica", fontSize=8.5,
                              textColor=GRAY, leading=11))
    styles.add(ParagraphStyle(name="QCellDesc", fontName="Helvetica", fontSize=9.5,
                              textColor=BLACK, leading=12))
    styles.add(ParagraphStyle(name="QTotalLabel", fontName="Helvetica-Bold", fontSize=9,
                              textColor=GRAY, alignment=TA_LEFT, leading=11))
    styles.add(ParagraphStyle(name="QTotalValue", fontName="Helvetica-Bold", fontSize=22,
                              textColor=GREEN, alignment=TA_LEFT, leading=24))

    story = []
    company = company or {}
    client = client or {}

    # ---------- Header: logo + company (left) | ORÇAMENTO + meta (right) ----------
    logo_io = _decode_image(company.get("logo") or "")
    left_cell = []
    if logo_io:
        try:
            left_cell.append(Image(logo_io, width=2.6 * cm, height=2.6 * cm, kind="proportional"))
            left_cell.append(Spacer(1, 4))
        except Exception:
            pass
    company_lines = [f"<b>{company.get('name','Sua Empresa')}</b>"]
    if company.get("legal_name"):
        company_lines.append(company["legal_name"])
    if company.get("document"):
        company_lines.append(f"CNPJ/CPF: {company['document']}")
    if company.get("email"):
        company_lines.append(company["email"])
    if company.get("phone"):
        company_lines.append(company["phone"])
    if company.get("address"):
        company_lines.append(company["address"])
    left_cell.append(Paragraph("EMITIDO POR", styles["QEyebrow"]))
    left_cell.append(Paragraph("<br/>".join(company_lines), styles["QBody"]))

    right_cell = [
        Paragraph("ORÇAMENTO", styles["QTitle"]),
        Paragraph(f"Nº <b>{quote.get('number','—')}</b>", styles["QMeta"]),
        Paragraph(f"Emissão: <b>{quote.get('date','—')}</b>", styles["QMeta"]),
        Paragraph(f"Validade: <b>{quote.get('expiration_date','—')}</b>", styles["QMeta"]),
        Paragraph(f"Status: <b>{quote.get('status','—')}</b>", styles["QMeta"]),
    ]
    header = Table([[left_cell, right_cell]],
                   colWidths=[doc.width * 0.55, doc.width * 0.45])
    header.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(header)
    story.append(Spacer(1, 10))
    story.append(Table([[""]], colWidths=[doc.width], rowHeights=[3],
                        style=TableStyle([("BACKGROUND", (0, 0), (-1, -1), GREEN)])))
    story.append(Spacer(1, 18))

    # ---------- Client card ----------
    client_lines = [f"<b>{client.get('name','—')}</b>"]
    if client.get("document"):
        client_lines.append(f"CPF/CNPJ: {client['document']}")
    if client.get("email"):
        client_lines.append(client["email"])
    if client.get("phone"):
        client_lines.append(client["phone"])
    if client.get("address"):
        client_lines.append(client["address"])
    client_card = Table([[
        [Paragraph("CLIENTE", styles["QEyebrow"]),
         Paragraph("<br/>".join(client_lines), styles["QBody"])]
    ]], colWidths=[doc.width])
    client_card.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), LIGHT),
        ("BOX", (0, 0), (-1, -1), 0.4, BORDER),
        ("LEFTPADDING", (0, 0), (-1, -1), 14),
        ("RIGHTPADDING", (0, 0), (-1, -1), 14),
        ("TOPPADDING", (0, 0), (-1, -1), 12),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
    ]))
    story.append(client_card)
    story.append(Spacer(1, 16))

    # ---------- Items table ----------
    data = [["#", "Descrição", "Qtd", "Un.", "Vlr. unit.", "Total"]]
    for i, it in enumerate(quote.get("items", []), 1):
        data.append([
            str(i),
            Paragraph(it.get("description", ""), styles["QCellDesc"]),
            f"{it.get('quantity',0):g}",
            it.get("unit", ""),
            _money(it.get("unit_price", 0)),
            _money(it.get("total", 0)),
        ])
    col_widths = [0.9 * cm, doc.width - (0.9 + 1.6 + 1.6 + 2.6 + 2.8) * cm,
                  1.6 * cm, 1.6 * cm, 2.6 * cm, 2.8 * cm]
    table = Table(data, colWidths=col_widths, repeatRows=1)
    table.setStyle(TableStyle([
        # Header row
        ("BACKGROUND", (0, 0), (-1, 0), BLACK),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 8.5),
        ("ALIGN", (0, 0), (-1, 0), "LEFT"),
        ("ALIGN", (2, 0), (-1, 0), "RIGHT"),
        ("ALIGN", (3, 0), (3, 0), "CENTER"),
        ("TOPPADDING", (0, 0), (-1, 0), 8),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 8),
        # Body
        ("FONTSIZE", (0, 1), (-1, -1), 9.5),
        ("ALIGN", (0, 1), (0, -1), "CENTER"),
        ("ALIGN", (2, 1), (-1, -1), "RIGHT"),
        ("ALIGN", (3, 1), (3, -1), "CENTER"),
        ("VALIGN", (0, 1), (-1, -1), "MIDDLE"),
        ("TEXTCOLOR", (0, 1), (0, -1), GRAY),
        ("FONTNAME", (5, 1), (5, -1), "Helvetica-Bold"),
        ("LINEBELOW", (0, 1), (-1, -1), 0.4, BORDER),
        ("TOPPADDING", (0, 1), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 10),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(table)
    story.append(Spacer(1, 14))

    # ---------- Totals ----------
    totals_rows = [
        ["Subtotal", _money(quote.get("subtotal", 0))],
    ]
    if float(quote.get("discount_value", 0) or 0) > 0:
        disc_label = "Desconto" + (" (%)" if quote.get('discount_type') == 'percent' else "")
        totals_rows.append([disc_label, f"- {_money(quote.get('discount_value', 0))}"])
    totals_small = Table(totals_rows, colWidths=[3.8 * cm, 3.5 * cm])
    totals_small.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("TEXTCOLOR", (0, 0), (0, -1), GRAY),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    total_hero = Table([[
        Paragraph("TOTAL", styles["QTotalLabel"]),
        Paragraph(_money(quote.get("total", 0)), styles["QTotalValue"]),
    ]], colWidths=[2.4 * cm, 4.9 * cm])
    total_hero.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.white),
        ("BOX", (0, 0), (-1, -1), 0.6, BORDER),
        ("LINEBEFORE", (0, 0), (0, -1), 3, GREEN),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (0, -1), 14),
        ("RIGHTPADDING", (1, 0), (1, -1), 14),
        ("TOPPADDING", (0, 0), (-1, -1), 12),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
    ]))
    totals_stack = Table([[totals_small], [Spacer(1, 6)], [total_hero]],
                         colWidths=[7.3 * cm])
    totals_stack.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    wrap = Table([[Spacer(1, 1), totals_stack]],
                 colWidths=[doc.width - 7.3 * cm, 7.3 * cm])
    wrap.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(wrap)
    story.append(Spacer(1, 18))

    # ---------- Conditions cards (payment / deadline / notes / terms) ----------
    conditions = []
    if quote.get("payment_method"):
        conditions.append(("FORMA DE PAGAMENTO", quote["payment_method"]))
    if quote.get("delivery_deadline"):
        conditions.append(("PRAZO", quote["delivery_deadline"]))
    if conditions:
        cells = []
        for label, value in conditions:
            cells.append([
                Paragraph(label, styles["QEyebrow"]),
                Paragraph(f"<b>{value}</b>", styles["QBody"]),
            ])
        # pad to 2 columns
        while len(cells) < 2:
            cells.append([Paragraph("&nbsp;", styles["QBody"])])
        cond_table = Table([cells], colWidths=[doc.width / 2, doc.width / 2])
        cond_table.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("BACKGROUND", (0, 0), (-1, -1), LIGHT),
            ("BOX", (0, 0), (-1, -1), 0.4, BORDER),
            ("LINEAFTER", (0, 0), (0, -1), 0.4, BORDER),
            ("LEFTPADDING", (0, 0), (-1, -1), 14),
            ("RIGHTPADDING", (0, 0), (-1, -1), 14),
            ("TOPPADDING", (0, 0), (-1, -1), 12),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
        ]))
        story.append(cond_table)
        story.append(Spacer(1, 12))

    def _text_card(label, content):
        card = Table([[[
            Paragraph(label, styles["QEyebrow"]),
            Paragraph(content.replace("\n", "<br/>"), styles["QBody"]),
        ]]], colWidths=[doc.width])
        card.setStyle(TableStyle([
            ("BOX", (0, 0), (-1, -1), 0.4, BORDER),
            ("BACKGROUND", (0, 0), (-1, -1), colors.white),
            ("LEFTPADDING", (0, 0), (-1, -1), 14),
            ("RIGHTPADDING", (0, 0), (-1, -1), 14),
            ("TOPPADDING", (0, 0), (-1, -1), 12),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
        ]))
        return card

    if quote.get("notes"):
        story.append(_text_card("OBSERVAÇÕES", quote["notes"]))
        story.append(Spacer(1, 10))
    if quote.get("terms"):
        story.append(_text_card("TERMOS E CONDIÇÕES", quote["terms"]))
        story.append(Spacer(1, 10))

    # ---------- Signature ----------
    if signature and signature.get("signature_data"):
        sig_io = _decode_image(signature["signature_data"])
        sig_left = [Paragraph("ACEITE ELETRÔNICO", styles["QEyebrow"])]
        if sig_io:
            try:
                sig_left.append(Image(sig_io, width=6 * cm, height=2.2 * cm, kind="proportional"))
            except Exception:
                pass
        sig_right = [
            Paragraph("ASSINADO POR", styles["QEyebrow"]),
            Paragraph(f"<b>{signature.get('signer_name','—')}</b>", styles["QBody"]),
            Paragraph(f"Data/Hora: {signature.get('signed_at','—')}", styles["QSmall"]),
            Paragraph(f"IP: {signature.get('ip','—')}", styles["QSmall"]),
        ]
        sig_card = Table([[sig_left, sig_right]],
                         colWidths=[doc.width * 0.55, doc.width * 0.45])
        sig_card.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f0fbf0")),
            ("BOX", (0, 0), (-1, -1), 0.6, GREEN),
            ("LEFTPADDING", (0, 0), (-1, -1), 14),
            ("RIGHTPADDING", (0, 0), (-1, -1), 14),
            ("TOPPADDING", (0, 0), (-1, -1), 12),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
        ]))
        story.append(sig_card)

    # ---------- Footer ----------
    def _footer(canvas, doc_):
        canvas.saveState()
        canvas.setStrokeColor(BORDER)
        canvas.setLineWidth(0.4)
        canvas.line(1.8 * cm, 1.6 * cm, pagesize[0] - 1.8 * cm, 1.6 * cm)
        canvas.setFont("Helvetica-Bold", 8)
        if watermark:
            canvas.setFillColor(GREEN)
            canvas.drawString(1.8 * cm, 1 * cm, "OrçaNext")
            canvas.setFont("Helvetica", 8)
            canvas.setFillColor(GRAY)
            canvas.drawString(3.05 * cm, 1 * cm, "· Crie. Envie. Aprove. Receba.")
        else:
            canvas.setFillColor(GRAY)
            canvas.setFont("Helvetica", 8)
            canvas.drawString(1.8 * cm, 1 * cm, company.get("name", ""))
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(GRAY)
        canvas.drawRightString(pagesize[0] - 1.8 * cm, 1 * cm,
                               f"Orçamento Nº {quote.get('number','—')}  ·  Página {canvas.getPageNumber()}")
        canvas.restoreState()

    doc.build(story, onFirstPage=_footer, onLaterPages=_footer)
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
