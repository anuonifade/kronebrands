import secrets
import string
from datetime import datetime, timezone

from fastapi import HTTPException

from .config import get_settings
from .models import CheckoutIn, OrderStatus
from .store_settings import get_store_settings, quote_shipping

ALPHABET = string.ascii_uppercase + string.digits


def now():
    return datetime.now(timezone.utc)


def new_order_number() -> str:
    return "KB-" + "".join(secrets.choice(ALPHABET) for _ in range(6))


async def reserve_stock(db, slug: str, size: str, qty: int) -> bool:
    res = await db.products.update_one(
        {"slug": slug, "active": True, "sizes": {"$elemMatch": {"size": size, "stock": {"$gte": qty}}}},
        {"$inc": {"sizes.$.stock": -qty}},
    )
    return res.modified_count == 1


async def release_stock(db, items: list[dict]) -> None:
    for it in items:
        await db.products.update_one(
            {"slug": it["slug"], "sizes.size": it["size"]},
            {"$inc": {"sizes.$.stock": it["quantity"]}},
        )


async def build_and_reserve(db, payload: CheckoutIn) -> dict:
    """Validates the cart against the catalogue (server-side prices), reserves
    stock atomically per line, and returns an unsaved order document."""
    s = get_settings()
    # merge duplicate lines
    merged: dict[tuple[str, str], int] = {}
    for it in payload.items:
        merged[(it.slug, it.size)] = merged.get((it.slug, it.size), 0) + it.quantity

    lines, reserved = [], []
    try:
        for (slug, size), qty in merged.items():
            p = await db.products.find_one({"slug": slug, "active": True})
            if not p:
                raise HTTPException(409, f"{slug} is no longer available. Remove it from your bag to continue")
            if size not in {sz["size"] for sz in p["sizes"]}:
                raise HTTPException(409, f"Size {size} doesn't exist for {p['name']}")
            if not await reserve_stock(db, slug, size, qty):
                raise HTTPException(409, f"{p['name']} ({p['colour']['name']}) in EU {size} has fewer than {qty} pairs left")
            reserved.append({"slug": slug, "size": size, "quantity": qty})
            lines.append({
                "slug": slug,
                "name": p["name"],
                "colour": p["colour"]["name"],
                "size": size,
                "quantity": qty,
                "unit_price_cents": p["price_cents"],
                "image": p["images"][0] if p["images"] else None,
            })
    except HTTPException:
        await release_stock(db, reserved)
        raise

    subtotal = sum(l["unit_price_cents"] * l["quantity"] for l in lines)
    # Rates are set in Admin → Settings; the destination country picks the zone.
    store = await get_store_settings(db)
    ship = quote_shipping(store["shipping"], subtotal, payload.shipping_address.country)
    shipping = ship["cents"]
    t = now()
    return {
        "email": payload.email.lower(),
        "full_name": payload.full_name,
        "phone": payload.phone,
        "shipping_address": payload.shipping_address.model_dump(),
        "note": payload.note,
        "items": lines,
        "currency": "USD",
        "subtotal_cents": subtotal,
        "shipping_cents": shipping,
        "shipping_zone": ship["zone"],
        "total_cents": subtotal + shipping,
        "status": OrderStatus.pending_payment.value,
        "payment": {"provider": s.payments_mode, "status": "pending", "reference": None},
        "fulfillment": {"carrier": None, "tracking_number": None, "shipped_at": None, "delivered_at": None},
        "timeline": [{"status": OrderStatus.pending_payment.value, "at": t, "note": "Order placed"}],
        "created_at": t,
        "updated_at": t,
    }


async def mark_paid(db, order_number: str, reference: str | None) -> dict | None:
    t = now()
    return await db.orders.find_one_and_update(
        {"order_number": order_number, "status": OrderStatus.pending_payment.value},
        {
            "$set": {
                "status": OrderStatus.paid.value,
                "payment.status": "paid",
                "payment.reference": reference,
                "paid_at": t,
                "updated_at": t,
            },
            "$push": {"timeline": {"status": OrderStatus.paid.value, "at": t, "note": "Payment received"}},
        },
        return_document=True,
    )


def public_view(order: dict) -> dict:
    keep = [
        "order_number", "email", "full_name", "shipping_address", "items", "currency",
        "subtotal_cents", "shipping_cents", "shipping_zone", "total_cents", "status",
        "fulfillment", "timeline", "created_at",
    ]
    out = {k: order.get(k) for k in keep}
    out["payment_status"] = order.get("payment", {}).get("status")
    return out
