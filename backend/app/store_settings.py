"""Store settings that staff can change without a deploy — currently shipping rates.

Kept in a single `settings` document so a quote is one cheap read. The first run seeds
it from the env vars the app used before, so existing installs keep their rates.
"""

from .config import get_settings

DOC_ID = "store"


def default_shipping() -> dict:
    s = get_settings()
    return {
        "zones": [
            {
                "id": "nigeria",
                "name": "Nigeria",
                "countries": ["NG"],
                "rate_cents": 1500,
                "free_over_cents": 25000,
            },
            {
                "id": "west-africa",
                "name": "West Africa",
                "countries": ["GH", "BJ", "TG", "CI", "SN", "CM"],
                "rate_cents": 4000,
                "free_over_cents": 50000,
            },
        ],
        # Everywhere a zone doesn't cover falls back to these.
        "default_rate_cents": s.shipping_flat_cents,
        "default_free_over_cents": s.free_shipping_threshold_cents,
    }


async def get_store_settings(db) -> dict:
    doc = await db.settings.find_one({"_id": DOC_ID})
    if not doc:
        doc = {"_id": DOC_ID, "shipping": default_shipping()}
        await db.settings.insert_one(dict(doc))
    doc.setdefault("shipping", default_shipping())
    return doc


async def save_shipping(db, shipping: dict) -> dict:
    await db.settings.update_one({"_id": DOC_ID}, {"$set": {"shipping": shipping}}, upsert=True)
    return await get_store_settings(db)


def quote_shipping(shipping: dict, subtotal_cents: int, country: str | None) -> dict:
    """What this order pays to ship, and which zone decided it.

    The first zone listing the destination country wins, so staff can order zones from
    most to least specific. Anything unmatched falls back to the default rate.
    """
    code = (country or "").strip().upper()
    zone = next((z for z in shipping.get("zones", []) if code and code in [c.upper() for c in z.get("countries", [])]), None)

    if zone:
        name, rate, free_over = zone["name"], zone["rate_cents"], zone.get("free_over_cents")
    else:
        name, rate = "Rest of world", shipping.get("default_rate_cents", 0)
        free_over = shipping.get("default_free_over_cents")

    free = free_over is not None and free_over >= 0 and subtotal_cents >= free_over
    return {
        "zone": name,
        "zone_id": zone["id"] if zone else None,
        "cents": 0 if free else rate,
        "rate_cents": rate,
        "free_over_cents": free_over,
        "is_free": free,
    }
