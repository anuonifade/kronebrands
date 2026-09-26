from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, EmailStr
from pymongo.errors import DuplicateKeyError

from ..config import get_settings
from ..db import get_db
from ..models import CheckoutIn
from ..orders_service import build_and_reserve, mark_paid, new_order_number, public_view, release_stock
from ..store_settings import get_store_settings, quote_shipping

router = APIRouter(prefix="/api", tags=["orders"])


@router.get("/config")
async def public_config():
    s = get_settings()
    shipping = (await get_store_settings(get_db()))["shipping"]
    # The defaults let the bag show a shipping line before a country is known.
    return {
        "payments_mode": s.payments_mode,
        "shipping_flat_cents": shipping["default_rate_cents"],
        "free_shipping_threshold_cents": shipping.get("default_free_over_cents"),
        "shipping_zones": [
            {"name": z["name"], "countries": z["countries"], "rate_cents": z["rate_cents"],
             "free_over_cents": z.get("free_over_cents")}
            for z in shipping.get("zones", [])
        ],
    }


@router.get("/shipping/quote")
async def shipping_quote(country: str = "", subtotal_cents: int = 0):
    """What checkout charges to ship to a country, so the total updates as it's typed."""
    shipping = (await get_store_settings(get_db()))["shipping"]
    return quote_shipping(shipping, max(0, subtotal_cents), country)


@router.post("/orders", status_code=201)
async def create_order(payload: CheckoutIn):
    db = get_db()
    s = get_settings()
    order = await build_and_reserve(db, payload)

    for _ in range(5):
        order["order_number"] = new_order_number()
        try:
            await db.orders.insert_one(order)
            break
        except DuplicateKeyError:
            continue
    else:
        await release_stock(db, order["items"])
        raise HTTPException(500, "Couldn't create an order number. Try again")

    checkout_url = None
    if s.payments_mode == "stripe":
        import stripe

        stripe.api_key = s.stripe_secret_key
        session = stripe.checkout.Session.create(
            mode="payment",
            customer_email=order["email"],
            line_items=[
                {
                    "quantity": it["quantity"],
                    "price_data": {
                        "currency": "usd",
                        "unit_amount": it["unit_price_cents"],
                        "product_data": {"name": f'{it["name"]} — {it["colour"]}, EU {it["size"]}'},
                    },
                }
                for it in order["items"]
            ]
            + (
                [{"quantity": 1, "price_data": {"currency": "usd", "unit_amount": order["shipping_cents"],
                                                 "product_data": {"name": "Shipping"}}}]
                if order["shipping_cents"] else []
            ),
            metadata={"order_number": order["order_number"]},
            success_url=f'{s.frontend_url}/order/{order["order_number"]}?email={order["email"]}',
            cancel_url=f"{s.frontend_url}/checkout?cancelled=1",
        )
        await db.orders.update_one({"_id": order["_id"]}, {"$set": {"payment.session_id": session.id}})
        checkout_url = session.url

    return {"order": public_view(order), "checkout_url": checkout_url, "payments_mode": s.payments_mode}


class DemoPayIn(BaseModel):
    email: EmailStr


@router.post("/orders/{order_number}/demo-pay")
async def demo_pay(order_number: str, body: DemoPayIn):
    """Test-mode payment. Disabled automatically once Stripe keys are set."""
    if get_settings().payments_mode != "demo":
        raise HTTPException(404, "Not found")
    db = get_db()
    order = await db.orders.find_one({"order_number": order_number, "email": body.email.lower()})
    if not order:
        raise HTTPException(404, "No order matches that number and email")
    updated = await mark_paid(db, order_number, reference=f"demo_{order_number}")
    return public_view(updated or order)


@router.get("/orders/lookup")
async def lookup(number: str, email: EmailStr):
    order = await get_db().orders.find_one({"order_number": number.strip().upper(), "email": email.lower()})
    if not order:
        raise HTTPException(404, "No order matches that number and email. Check both and try again")
    return public_view(order)


@router.post("/payments/stripe/webhook")
async def stripe_webhook(request: Request):
    s = get_settings()
    if s.payments_mode != "stripe":
        raise HTTPException(404, "Not found")
    import stripe

    payload = await request.body()
    try:
        event = stripe.Webhook.construct_event(payload, request.headers.get("stripe-signature"), s.stripe_webhook_secret)
    except Exception:
        raise HTTPException(400, "Invalid signature")

    db = get_db()
    obj = event["data"]["object"]
    number = (obj.get("metadata") or {}).get("order_number")
    if event["type"] == "checkout.session.completed" and number:
        await mark_paid(db, number, reference=obj.get("payment_intent"))
    elif event["type"] == "checkout.session.expired" and number:
        order = await db.orders.find_one_and_update(
            {"order_number": number, "status": "pending_payment"},
            {"$set": {"status": "cancelled", "payment.status": "expired"},
             "$push": {"timeline": {"status": "cancelled", "note": "Payment session expired"}}},
        )
        if order:
            await release_stock(db, order["items"])
    return {"received": True}
