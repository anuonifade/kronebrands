import re
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from ..auth import create_token, require_admin, verify_password
from ..db import get_db
from ..models import ALLOWED_TRANSITIONS, LoginIn, OrderStatus, ShippingIn, StatusUpdateIn, serialize
from ..orders_service import release_stock
from ..storage import storage_status
from ..store_settings import get_store_settings, quote_shipping, save_shipping

router = APIRouter(prefix="/api/admin", tags=["admin"])

# Statuses that represent money actually taken.
REVENUE_STATUSES = ["paid", "processing", "shipped", "delivered"]


@router.post("/login")
async def login(body: LoginIn):
    admin = await get_db().admins.find_one({"email": body.email.lower()})
    if not admin or not verify_password(body.password, admin["password_hash"]):
        raise HTTPException(401, "Email or password is incorrect")
    return {"token": create_token(admin["email"]), "email": admin["email"]}


@router.get("/me")
async def me(admin=Depends(require_admin)):
    return {"email": admin["email"]}


# ---------- Dashboard ----------
def _day(dt: datetime) -> str:
    return dt.date().isoformat()


def _as_dt(v) -> Optional[datetime]:
    if isinstance(v, datetime):
        return v if v.tzinfo else v.replace(tzinfo=timezone.utc)
    if isinstance(v, str):
        try:
            return datetime.fromisoformat(v.replace("Z", "+00:00"))
        except ValueError:
            return None
    return None


@router.get("/stats")
async def stats(days: int = Query(30, ge=7, le=365), _=Depends(require_admin)):
    """Everything the dashboard draws.

    Totals come from cheap grouped counts; the trend, best sellers and averages are
    worked out in Python over one bounded window of recent orders, which keeps this to
    two round trips and avoids leaning on exotic aggregation operators.
    """
    db = get_db()
    counts = {s.value: 0 for s in OrderStatus}
    async for row in db.orders.aggregate([{"$group": {"_id": "$status", "n": {"$sum": 1}}}]):
        if row["_id"] in counts:
            counts[row["_id"]] = row["n"]

    revenue = 0
    async for row in db.orders.aggregate([
        {"$match": {"status": {"$in": REVENUE_STATUSES}}},
        {"$group": {"_id": None, "total": {"$sum": "$total_cents"}}},
    ]):
        revenue = row["total"]

    since = datetime.now(timezone.utc) - timedelta(days=days)
    window = await db.orders.find({"created_at": {"$gte": since}}).sort("created_at", -1).to_list(5000)

    # Daily buckets, zero-filled so the chart has no gaps.
    series = {(since + timedelta(days=i)).date().isoformat(): {"revenue_cents": 0, "orders": 0}
              for i in range(days + 1)}
    units = defaultdict(lambda: {"units": 0, "revenue_cents": 0, "name": "", "colour": "", "image": None})
    period_revenue = period_orders = 0
    seen_emails: set[str] = set()

    for o in window:
        created = _as_dt(o.get("created_at"))
        earning = o.get("status") in REVENUE_STATUSES
        if created and (key := _day(created)) in series and earning:
            series[key]["revenue_cents"] += o.get("total_cents", 0)
            series[key]["orders"] += 1
        if not earning:
            continue
        period_revenue += o.get("total_cents", 0)
        period_orders += 1
        seen_emails.add(o.get("email", ""))
        for line in o.get("items", []):
            row = units[line["slug"]]
            row["units"] += line.get("quantity", 0)
            row["revenue_cents"] += line.get("unit_price_cents", 0) * line.get("quantity", 0)
            row["name"], row["colour"] = line.get("name", ""), line.get("colour", "")
            row["image"] = row["image"] or line.get("image")

    top_products = sorted(
        ({"slug": k, **v} for k, v in units.items()), key=lambda r: r["units"], reverse=True
    )[:6]

    low_stock = []
    async for p in db.products.find({"active": True}):
        for sz in p["sizes"]:
            if sz["stock"] <= 2:
                low_stock.append({"slug": p["slug"], "name": p["name"], "colour": p["colour"]["name"],
                                  "size": sz["size"], "stock": sz["stock"], "image": (p.get("images") or [None])[0]})

    recent = await db.orders.find({}).sort("created_at", -1).to_list(8)

    return {
        "counts": counts,
        "to_fulfil": counts["paid"] + counts["processing"],
        "revenue_cents": revenue,
        "low_stock": low_stock,
        "window_days": days,
        "period": {
            "revenue_cents": period_revenue,
            "orders": period_orders,
            "avg_order_cents": round(period_revenue / period_orders) if period_orders else 0,
            "customers": len([e for e in seen_emails if e]),
        },
        "series": [{"date": d, **v} for d, v in sorted(series.items())],
        "top_products": top_products,
        "recent_orders": [serialize(o) for o in recent],
        "products_total": await db.products.count_documents({}),
        "products_active": await db.products.count_documents({"active": True}),
    }


# ---------- Orders ----------
@router.get("/orders")
async def list_orders(
    status: Optional[OrderStatus] = None,
    q: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    _=Depends(require_admin),
):
    filt: dict = {}
    if status:
        filt["status"] = status.value
    if q:
        rx = {"$regex": re.escape(q.strip()), "$options": "i"}
        filt["$or"] = [{"order_number": rx}, {"email": rx}, {"full_name": rx}]
    db = get_db()
    total = await db.orders.count_documents(filt)
    docs = (
        await db.orders.find(filt).sort("created_at", -1).skip((page - 1) * page_size).limit(page_size).to_list(page_size)
    )
    return {"total": total, "page": page, "page_size": page_size, "orders": [serialize(d) for d in docs]}


@router.get("/orders/{order_number}")
async def get_order(order_number: str, _=Depends(require_admin)):
    doc = await get_db().orders.find_one({"order_number": order_number})
    if not doc:
        raise HTTPException(404, "Order not found")
    return serialize(doc)


@router.post("/orders/{order_number}/status")
async def update_status(order_number: str, body: StatusUpdateIn, admin=Depends(require_admin)):
    db = get_db()
    order = await db.orders.find_one({"order_number": order_number})
    if not order:
        raise HTTPException(404, "Order not found")
    current = OrderStatus(order["status"])
    if body.status not in ALLOWED_TRANSITIONS[current]:
        raise HTTPException(
            409, f"An order that is {current.value.replace('_', ' ')} can't be marked {body.status.value.replace('_', ' ')}"
        )
    if body.status == OrderStatus.shipped and not body.tracking_number:
        raise HTTPException(422, "Add a tracking number to mark this order shipped")

    t = datetime.now(timezone.utc)
    sets: dict = {"status": body.status.value, "updated_at": t}
    if body.status == OrderStatus.shipped:
        sets.update({
            "fulfillment.carrier": body.carrier,
            "fulfillment.tracking_number": body.tracking_number,
            "fulfillment.shipped_at": t,
        })
    if body.status == OrderStatus.delivered:
        sets["fulfillment.delivered_at"] = t

    entry = {"status": body.status.value, "at": t, "note": body.note, "by": admin["email"]}
    updated = await db.orders.find_one_and_update(
        {"order_number": order_number, "status": current.value},  # guards against concurrent updates
        {"$set": sets, "$push": {"timeline": entry}},
        return_document=True,
    )
    if not updated:
        raise HTTPException(409, "This order changed while you were editing it. Reload and try again")
    if body.status == OrderStatus.cancelled:
        await release_stock(db, order["items"])
    return serialize(updated)


# ---------- Customers ----------
def _summarise(email: str, orders: list[dict]) -> dict:
    """One customer's history, newest order first."""
    earning = [o for o in orders if o.get("status") in REVENUE_STATUSES]
    spent = sum(o.get("total_cents", 0) for o in earning)
    latest = orders[0]
    return {
        "email": email,
        "name": latest.get("full_name", ""),
        "phone": latest.get("phone"),
        "orders": len(orders),
        "paid_orders": len(earning),
        "spent_cents": spent,
        "avg_order_cents": round(spent / len(earning)) if earning else 0,
        "first_order_at": orders[-1].get("created_at"),
        "last_order_at": latest.get("created_at"),
        "last_status": latest.get("status"),
        "country": (latest.get("shipping_address") or {}).get("country"),
        "city": (latest.get("shipping_address") or {}).get("city"),
    }


@router.get("/customers")
async def list_customers(
    q: Optional[str] = None,
    sort: str = Query("spent", pattern="^(spent|orders|recent|name)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    _=Depends(require_admin),
):
    """Customers are derived from orders — the store has no separate sign-up."""
    filt: dict = {}
    if q:
        rx = {"$regex": re.escape(q.strip()), "$options": "i"}
        filt["$or"] = [{"email": rx}, {"full_name": rx}]

    docs = await get_db().orders.find(filt).sort("created_at", -1).to_list(10000)
    by_email: dict[str, list[dict]] = defaultdict(list)
    for o in docs:
        if email := o.get("email"):
            by_email[email].append(o)

    rows = [_summarise(email, orders) for email, orders in by_email.items()]
    keys = {
        "spent": lambda r: -r["spent_cents"],
        "orders": lambda r: -r["orders"],
        "name": lambda r: (r["name"] or "").lower(),
        "recent": lambda r: r["last_order_at"] or "",
    }
    rows.sort(key=keys[sort], reverse=sort == "recent")

    start = (page - 1) * page_size
    return {"total": len(rows), "page": page, "page_size": page_size, "customers": rows[start:start + page_size]}


@router.get("/customers/{email}")
async def get_customer(email: str, _=Depends(require_admin)):
    orders = await get_db().orders.find({"email": email.lower()}).sort("created_at", -1).to_list(200)
    if not orders:
        raise HTTPException(404, "No customer with that email has ordered")
    summary = _summarise(email.lower(), orders)
    # Distinct addresses they've shipped to, newest first.
    addresses, seen = [], set()
    for o in orders:
        a = o.get("shipping_address") or {}
        key = tuple(sorted(a.items()))
        if a and key not in seen:
            seen.add(key)
            addresses.append(a)
    return {**summary, "addresses": addresses, "order_history": [serialize(o) for o in orders]}


# ---------- Store settings ----------
@router.get("/settings")
async def read_settings(_=Depends(require_admin)):
    doc = await get_store_settings(get_db())
    return {"shipping": doc["shipping"], "storage": storage_status()}


@router.put("/settings/shipping")
async def write_shipping(body: ShippingIn, _=Depends(require_admin)):
    zones = [z.model_dump() for z in body.zones]
    ids = [z["id"] for z in zones]
    if len(ids) != len(set(ids)):
        raise HTTPException(422, "Two zones share the same id. Give each zone a distinct name")
    claimed: dict[str, str] = {}
    for z in zones:
        z["countries"] = [c.strip().upper() for c in z["countries"] if c.strip()]
        for c in z["countries"]:
            if c in claimed:
                raise HTTPException(422, f"{c} is in both “{claimed[c]}” and “{z['name']}”. A country belongs to one zone")
            claimed[c] = z["name"]

    shipping = {
        "zones": zones,
        "default_rate_cents": body.default_rate_cents,
        "default_free_over_cents": body.default_free_over_cents,
    }
    doc = await save_shipping(get_db(), shipping)
    return {"shipping": doc["shipping"]}


@router.get("/settings/shipping/preview")
async def preview_shipping(country: str = "", subtotal_cents: int = 0, _=Depends(require_admin)):
    """Lets the settings screen show what a basket would actually be charged."""
    shipping = (await get_store_settings(get_db()))["shipping"]
    return quote_shipping(shipping, max(0, subtotal_cents), country)
