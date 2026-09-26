"""Catalogue management: products, their image galleries, and image uploads.

Split out from admin.py so order fulfilment and catalogue editing stay readable
apart; both mount under /api/admin and share the same bearer-token guard.
"""

import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile

from ..auth import require_admin
from ..db import get_db
from ..models import ImageIn, ImagesIn, ProductCreate, ProductUpdate, serialize
from ..storage import ALLOWED_TYPES, StorageError, get_storage, storage_status

router = APIRouter(prefix="/api/admin", tags=["admin"])

# Fields an admin may clear by sending an empty string, rather than leave unchanged.
CLEARABLE = {"badge", "video"}


async def _get_or_404(db, slug: str) -> dict:
    doc = await db.products.find_one({"slug": slug})
    if not doc:
        raise HTTPException(404, "Product not found")
    return doc


@router.get("/products")
async def admin_products(
    q: str | None = None,
    line: str | None = None,
    active: bool | None = None,
    _=Depends(require_admin),
):
    filt: dict = {}
    if q:
        rx = {"$regex": re.escape(q.strip()), "$options": "i"}
        filt["$or"] = [{"name": rx}, {"slug": rx}, {"line": rx}, {"colour.name": rx}]
    if line:
        filt["line"] = line
    if active is not None:
        filt["active"] = active
    docs = await get_db().products.find(filt).sort([("line", 1), ("slug", 1)]).to_list(500)
    return [serialize(d) for d in docs]


@router.get("/products/{slug}")
async def admin_product(slug: str, _=Depends(require_admin)):
    return serialize(await _get_or_404(get_db(), slug))


@router.post("/products", status_code=201)
async def create_product(body: ProductCreate, _=Depends(require_admin)):
    db = get_db()
    if await db.products.find_one({"slug": body.slug}):
        raise HTTPException(409, f"“{body.slug}” is already taken. Pick a different web address")
    doc = body.model_dump()
    doc["currency"] = "USD"
    doc["created_at"] = datetime.now(timezone.utc)
    await db.products.insert_one(doc)
    return serialize(await db.products.find_one({"slug": body.slug}))


@router.patch("/products/{slug}")
async def update_product(slug: str, body: ProductUpdate, _=Depends(require_admin)):
    # model_dump already flattens the nested colour/size models to plain dicts.
    changes = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None or k in CLEARABLE}
    if not changes:
        raise HTTPException(422, "Nothing to update")
    for field in CLEARABLE:
        if changes.get(field) == "":
            changes[field] = None

    doc = await get_db().products.find_one_and_update({"slug": slug}, {"$set": changes}, return_document=True)
    if not doc:
        raise HTTPException(404, "Product not found")
    return serialize(doc)


@router.delete("/products/{slug}")
async def delete_product(slug: str, _=Depends(require_admin)):
    """Removes the product from the catalogue. Past orders keep their own copy of the
    line — name, colour, price and image — so order history stays intact."""
    db = get_db()
    await _get_or_404(db, slug)
    await db.products.delete_one({"slug": slug})
    return {"deleted": slug}


# ---------- Images ----------
@router.get("/products/{slug}/images")
async def list_images(slug: str, _=Depends(require_admin)):
    doc = await _get_or_404(get_db(), slug)
    return {"images": doc.get("images", []), "video": doc.get("video")}


@router.put("/products/{slug}/images")
async def replace_images(slug: str, body: ImagesIn, _=Depends(require_admin)):
    """The whole gallery in one write — how reordering and setting the hero are saved."""
    urls = [u.strip() for u in body.images if u.strip()]
    if len(urls) != len(set(urls)):
        raise HTTPException(422, "The same image is in the gallery twice")
    doc = await get_db().products.find_one_and_update(
        {"slug": slug}, {"$set": {"images": urls}}, return_document=True
    )
    if not doc:
        raise HTTPException(404, "Product not found")
    return {"images": doc.get("images", [])}


@router.post("/products/{slug}/images", status_code=201)
async def add_image(slug: str, body: ImageIn, _=Depends(require_admin)):
    db = get_db()
    doc = await _get_or_404(db, slug)
    images = list(doc.get("images", []))
    url = body.url.strip()
    if url in images:
        raise HTTPException(409, "That image is already in this gallery")
    at = len(images) if body.position is None else max(0, min(body.position, len(images)))
    images.insert(at, url)
    await db.products.update_one({"slug": slug}, {"$set": {"images": images}})
    return {"images": images}


@router.delete("/products/{slug}/images/{index}")
async def remove_image(slug: str, index: int, _=Depends(require_admin)):
    """Takes the shot out of this product's gallery. The file itself is left in storage,
    since the same URL may be used by another product or a past order."""
    db = get_db()
    doc = await _get_or_404(db, slug)
    images = list(doc.get("images", []))
    if not 0 <= index < len(images):
        raise HTTPException(404, "There's no image at that position")
    images.pop(index)
    await db.products.update_one({"slug": slug}, {"$set": {"images": images}})
    return {"images": images}


# ---------- Uploads ----------
@router.get("/media/status")
async def media_status(_=Depends(require_admin)):
    return storage_status()


@router.post("/media", status_code=201)
async def upload_media(file: UploadFile = File(...), _=Depends(require_admin)):
    from ..config import get_settings

    store = get_storage()
    if not store:
        raise HTTPException(503, storage_status()["reason"])

    content_type = (file.content_type or "").split(";")[0].strip().lower()
    if content_type not in ALLOWED_TYPES:
        raise HTTPException(415, f"{content_type or 'That file'} isn't a supported image. Use JPEG, PNG, WebP or AVIF")

    limit = get_settings().max_upload_bytes
    data = await file.read(limit + 1)
    if len(data) > limit:
        raise HTTPException(413, f"That image is larger than {limit // (1024 * 1024)}MB")
    if not data:
        raise HTTPException(422, "That file is empty")

    try:
        up = store.upload(data, file.filename or "image", content_type)
    except StorageError as e:
        raise HTTPException(502, str(e)) from e
    return {"url": up.url, "provider": up.provider, "bytes": len(data)}


@router.get("/lines")
async def product_lines(_=Depends(require_admin)):
    """Existing lines and categories, so the product form can offer them."""
    db = get_db()
    docs = await db.products.find({}, {"line": 1, "category": 1}).to_list(500)
    return {
        "lines": sorted({d["line"] for d in docs if d.get("line")}),
        "categories": sorted({d["category"] for d in docs if d.get("category")}),
    }
