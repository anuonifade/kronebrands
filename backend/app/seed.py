from datetime import datetime, timezone

from .auth import hash_password
from .config import get_settings
from .media import SHOTS, VIDEO

EU_SIZES = ["39", "40", "41", "42", "43", "44", "45", "46"]


def _sizes(stock: int = 8) -> list[dict]:
    return [{"size": s, "stock": stock} for s in EU_SIZES]


ROYAL_COPY = (
    "Our signature loafer. Cut from dense cotton velvet over a hand-lasted leather "
    "sole, with the Krone crest embroidered in gold thread on the vamp. Unlined "
    "heel for a soft break-in; leather insole; stacked leather heel."
)

ROYAL_COLOURS = [
    ("black", "Black", "#15130F", "Best seller"),
    ("blue", "Blue", "#1F2F6B", None),
    ("green", "Green", "#1D4A39", None),
    ("magenta", "Magenta", "#8A1E5C", None),
    ("brown", "Brown", "#5A3A28", None),
]

PRODUCTS: list[dict] = [
    {
        "slug": f"royal-crested-{key}-velvet-loafers",
        "name": "Royal",
        "line": "Royal",
        "category": "Velvet loafers",
        "description": ROYAL_COPY,
        "price_cents": 25000,
        "colour": {"name": f"{label} velvet", "hex": hexv},
        "images": SHOTS[f"royal_{key}"],
        "video": VIDEO.get(f"royal_{key}_turntable"),
        "sizes": _sizes(),
        "badge": badge,
        "featured": True,
    }
    for key, label, hexv, badge in ROYAL_COLOURS
] + [
    {
        "slug": "dignity-front-strap-velvet-loafers",
        "name": "Dignity",
        "line": "Dignity",
        "category": "Velvet loafers",
        "description": "A clean velvet loafer finished with a single leather strap across the vamp, "
                       "with the Krone crest in gold at its centre. Leather sole and insole, low stacked heel.",
        "price_cents": 20000,
        "colour": {"name": "Black velvet", "hex": "#15130F"},
        "images": SHOTS["dignity"],
        "sizes": _sizes(),
        "badge": "New arrival",
        "featured": True,
    },
    {
        "slug": "prime-double-strapped-buckle-loafers",
        "name": "Prime",
        "line": "Prime",
        "category": "Monk straps",
        "description": "Polished calf leather with two brass buckles and the Krone crest in gold on the outside "
                       "quarter. Built on a slightly longer last for a sharper line under tailored trousers.",
        "price_cents": 25000,
        "colour": {"name": "Dark brown calf", "hex": "#3B2418"},
        "images": SHOTS["prime"],
        "sizes": _sizes(),
        "featured": True,
    },
    {
        "slug": "sovereign-oxford-brogues",
        "name": "Sovereign",
        "line": "Sovereign",
        "category": "Brogues",
        "description": "A full wingtip oxford in burnished tan leather, hand-punched brogueing, closed lacing "
                       "and a leather sole. The Krone crest sits in gold on the outside quarter.",
        "price_cents": 28000,
        "colour": {"name": "Tan leather", "hex": "#8A5A34"},
        "images": SHOTS["sovereign"],
        "sizes": _sizes(),
        "featured": True,
    },
    {
        "slug": "grandeur-two-tone-brogue-loafers",
        "name": "Grandeur",
        "line": "Grandeur",
        "category": "Brogues",
        "description": "Black calf vamp with a cognac brogued wingtip and the Krone crest in gold on the "
                       "outside quarter. A loafer with the detail of a dress shoe.",
        "price_cents": 25500,
        "colour": {"name": "Black / cognac", "hex": "#2A1C14"},
        "images": SHOTS["grandeur"],
        "sizes": _sizes(),
        "featured": True,
    },
]


async def seed(db, force: bool = False) -> None:
    now = datetime.now(timezone.utc)
    for p in PRODUCTS:
        doc = {"active": True, "currency": "USD", "video": None, "badge": None, **p}
        if force:
            await db.products.replace_one({"slug": p["slug"]}, {**doc, "created_at": now}, upsert=True)
        elif not await db.products.find_one({"slug": p["slug"]}):
            await db.products.insert_one({**doc, "created_at": now})
        else:
            # Brand media is owned by the code, so keep an existing catalogue in step with it —
            # otherwise re-shot photography never reaches a database that was seeded once.
            # Stock, price and visibility stay exactly as the admin left them.
            await db.products.update_one(
                {"slug": p["slug"]}, {"$set": {"images": doc["images"], "video": doc["video"]}}
            )

    s = get_settings()
    if not await db.admins.find_one({"email": s.admin_email}):
        await db.admins.insert_one(
            {"email": s.admin_email, "password_hash": hash_password(s.admin_password), "created_at": now}
        )


if __name__ == "__main__":
    import asyncio
    import sys

    from .db import ensure_indexes, get_db

    async def _main():
        db = get_db()
        await ensure_indexes(db)
        await seed(db, force="--force" in sys.argv)
        print("Seeded products and admin user.")

    asyncio.run(_main())
