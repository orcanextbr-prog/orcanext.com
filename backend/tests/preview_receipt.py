"""Render the new receipt PDF with sample data (no DB), for quick visual QA."""
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
from pdf_generator import build_receipt_pdf

sample_company = {
    "name": "Solar Instalações Ltda.",
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
sample_receipt = {
    "number": "REC-2026-00042",
    "amount": 20140.00,
    "description": "Instalação de painel solar 5kWp + consultoria técnica",
    "payment_method": "PIX",
    "payment_date": "22/02/2026",
    "notes": "Pagamento à vista. Nota fiscal emitida separadamente.",
}
out = pathlib.Path("/tmp/receipt_preview.pdf")
out.write_bytes(build_receipt_pdf(sample_receipt, sample_company, sample_client))
print(f"OK -> {out} ({out.stat().st_size} bytes)")

# Edge case: no notes, no client document, minimal company
minimal_out = pathlib.Path("/tmp/receipt_preview_min.pdf")
minimal_out.write_bytes(build_receipt_pdf(
    {"number": "REC-2026-00043", "amount": 750, "description": "Consultoria — 3h",
     "payment_method": "DINHEIRO", "payment_date": "23/02/2026", "notes": ""},
    {"name": "Prestador Autônomo", "document": None, "email": None, "phone": None, "address": None},
    {"name": "Cliente Anônimo", "document": None, "email": None, "phone": None, "address": None},
))
print(f"OK -> {minimal_out} ({minimal_out.stat().st_size} bytes)")
