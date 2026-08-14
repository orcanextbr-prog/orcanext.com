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
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4,
                             leftMargin=2 * cm, rightMargin=2 * cm,
                             topMargin=2 * cm, bottomMargin=2 * cm)
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="Big", fontName="Helvetica-Bold", fontSize=28,
                              textColor=BLACK, alignment=TA_CENTER, spaceAfter=8))
    styles.add(ParagraphStyle(name="Amount", fontName="Helvetica-Bold", fontSize=22,
                              textColor=GREEN, alignment=TA_CENTER, spaceAfter=12))
    styles.add(ParagraphStyle(name="Body2", fontName="Helvetica", fontSize=11,
                              textColor=BLACK, spaceAfter=6))
    story = []
    company = company or {}
    client = client or {}
    story.append(Paragraph("RECIBO", styles["Big"]))
    story.append(Paragraph(f"Nº {receipt.get('number','')}", styles["Body2"]))
    story.append(Spacer(1, 6))
    story.append(Paragraph(_money(receipt.get("amount", 0)), styles["Amount"]))
    story.append(Paragraph(
        f"Recebi(emos) de <b>{client.get('name','—')}</b> "
        f"({client.get('document','')}), a importância de "
        f"<b>{_money(receipt.get('amount',0))}</b> referente a "
        f"<b>{receipt.get('description','—')}</b>, pago via "
        f"<b>{receipt.get('payment_method','')}</b> em "
        f"<b>{receipt.get('payment_date','')}</b>.",
        styles["Body2"]))
    story.append(Spacer(1, 24))
    story.append(Paragraph(f"<b>{company.get('name','')}</b>", styles["Body2"]))
    if company.get("document"):
        story.append(Paragraph(f"CNPJ/CPF: {company['document']}", styles["Body2"]))
    if receipt.get("notes"):
        story.append(Spacer(1, 10))
        story.append(Paragraph(f"<i>{receipt['notes']}</i>", styles["Body2"]))
    doc.build(story)
    return buf.getvalue()
