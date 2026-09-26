from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from ..db import get_db
from ..models import serialize

router = APIRouter(prefix="/api/products", tags=["products"])


@router.get("")
async def list_products(
    line: Optional[str] = None,
    category: Optional[str] = None,
    featured: Optional[bool] = None,
    sort: str = Query("featured", pattern="^(featured|price_asc|price_desc|newest)$"),
):
    q: dict = {"active": True}
    if line:
        q["line"] = line
    if category:
        q["category"] = category
    if featured is not None:
        q["featured"] = featured
    order = {
        "featured": [("featured", -1), ("line", 1)],
        "price_asc": [("price_cents", 1)],
        "price_desc": [("price_cents", -1)],
        "newest": [("created_at", -1)],
    }[sort]
    docs = await get_db().products.find(q).sort(order).to_list(200)
    return [serialize(d) for d in docs]


@router.get("/{slug}")
async def get_product(slug: str):
    db = get_db()
    doc = await db.products.find_one({"slug": slug, "active": True})
    if not doc:
        raise HTTPException(404, "This product isn't available")
    siblings = await db.products.find(
        {"line": doc["line"], "active": True, "slug": {"$ne": slug}},
        {"slug": 1, "colour": 1, "images": 1},
    ).to_list(20)
    out = serialize(doc)
    out["colourways"] = [serialize(s) for s in siblings]
    return out
