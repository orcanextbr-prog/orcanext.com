"""Idempotent Stripe catalog setup for OrçaNext.

Creates the Profissional product with monthly (R$ 49,90) and annual
(R$ 478,80) prices in BRL. Safe to re-run — deduplicates via metadata
and lookup_keys (matches integration playbook A3).

Run once after configuring env vars:
    cd /app/backend && python3 setup_stripe.py
"""
import os
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")

import stripe

stripe.api_key = os.environ["STRIPE_SECRET_KEY"]

CATALOG = [
    {
        "emergent_product_id": "orcanext_professional",
        "name": "OrçaNext Profissional",
        "description": "Orçamentos ilimitados, recibos, PDF profissional e todos os recursos do OrçaNext.",
        "tax_code": "txcd_10103001",  # SaaS
        "prices": [
            {"lookup_key": "orcanext_pro_monthly", "amount": 4990, "currency": "brl", "interval": "month"},
            {"lookup_key": "orcanext_pro_yearly", "amount": 47880, "currency": "brl", "interval": "year"},
        ],
    },
]


def get_or_create_product(entry: dict):
    for p in stripe.Product.list(active=True, limit=100).auto_paging_iter():
        if p.to_dict().get("metadata", {}).get("emergent_product_id") == entry["emergent_product_id"]:
            return p
    return stripe.Product.create(
        name=entry["name"],
        description=entry.get("description"),
        tax_code=entry.get("tax_code"),
        metadata={"managed_by": "emergent", "emergent_product_id": entry["emergent_product_id"]},
    )


def ensure_price(product, spec: dict):
    existing = stripe.Price.list(lookup_keys=[spec["lookup_key"]], active=True, limit=1).data
    if existing:
        p = existing[0]
        if p.unit_amount != spec["amount"] or p.currency != spec["currency"]:
            stripe.Price.modify(p.id, active=False)
            existing = []
    if not existing:
        p = stripe.Price.create(
            product=product.id,
            unit_amount=spec["amount"],
            currency=spec["currency"],
            lookup_key=spec["lookup_key"],
            transfer_lookup_key=True,
            recurring={"interval": spec["interval"]},
        )
    else:
        p = existing[0]
    return p


def main() -> None:
    for entry in CATALOG:
        product = get_or_create_product(entry)
        print(f"Product: {product.name} ({product.id})")
        for spec in entry["prices"]:
            price = ensure_price(product, spec)
            print(f"  Price [{spec['lookup_key']}]: {price.id} — {price.currency.upper()} {price.unit_amount/100:.2f} / {spec['interval']}")


if __name__ == "__main__":
    main()
