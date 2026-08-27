"""Render the new quote PDF with sample data (no DB), for quick visual QA."""
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
from pdf_generator import build_quote_pdf

sample_company = {
    "name": "Solar Instalações Ltda.",
    "legal_name": "Solar Instalações e Serviços LTDA",
    "document": "12.345.678/0001-90",
    "email": "financeiro@solarinstalacoes.com.br",
    "phone": "(11) 98765-4321",
    "address": "Rua das Palmeiras, 123 · Vila Nova · São Paulo/SP · 04567-000",
}
sample_client = {
    "name": "Marcos Almeida da Silva",
    "document": "123.456.789-00",
    "email": "marcos.almeida@example.com",
    "phone": "(11) 99999-0000",
    "address": "Av. Paulista, 1500 · Bela Vista · São Paulo/SP",
}
items = [
    {"description": "Instalação de painel solar 5kWp — kit completo", "quantity": 1, "unit": "UN", "unit_price": 18900, "total": 18900},
    {"description": "Consultoria técnica e projeto elétrico", "quantity": 3, "unit": "h", "unit_price": 250, "total": 750},
    {"description": "Suporte pós-instalação (12 meses)", "quantity": 1, "unit": "UN", "unit_price": 490, "total": 490},
]
sample_quote = {
    "number": "2026-0042",
    "date": "22/02/2026",
    "expiration_date": "10/03/2026",
    "status": "ENVIADO",
    "items": items,
    "subtotal": 20140,
    "discount_type": "value",
    "discount_value": 0,
    "total": 20140,
    "payment_method": "Boleto ou PIX à vista",
    "delivery_deadline": "Até 15 dias úteis após aprovação",
    "notes": "Instalação com equipe própria. Garantia de 12 meses em serviços e 10 anos em painéis (do fabricante).",
    "terms": "Este orçamento é válido pelo período informado. Aprovação implica aceite dos termos comerciais.\nCancelamentos após início da obra podem gerar cobrança proporcional.",
    "orientation": "vertical",
}

out = pathlib.Path("/tmp/quote_preview.pdf")
out.write_bytes(build_quote_pdf(sample_quote, sample_company, sample_client, None, watermark=True))
print(f"OK -> {out} ({out.stat().st_size} bytes)")

# Multi-page pagination test
big_items = items * 12
sample_quote_big = {**sample_quote, "items": big_items,
                    "subtotal": sum(i["total"] for i in big_items),
                    "total": sum(i["total"] for i in big_items),
                    "number": "2026-0043"}
big = pathlib.Path("/tmp/quote_preview_big.pdf")
big.write_bytes(build_quote_pdf(sample_quote_big, sample_company, sample_client, None, watermark=True))
print(f"OK -> {big} ({big.stat().st_size} bytes)")
