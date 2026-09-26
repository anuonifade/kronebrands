"""Admin surface: dashboard, product + image CRUD, customers, shipping settings."""

import pytest
from httpx import ASGITransport, AsyncClient
from mongomock_motor import AsyncMongoMockClient

from app import db as dbmod
from app.config import get_settings
from app.main import app
from app.seed import seed
from app.store_settings import quote_shipping

SLUG = "royal-crested-magenta-velvet-loafers"


@pytest.fixture
async def client():
    mock = AsyncMongoMockClient()["kb_admin_test"]
    dbmod.set_db(mock)
    await seed(mock, force=True)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c:
        yield c


async def headers(c):
    s = get_settings()
    r = await c.post("/api/admin/login", json={"email": s.admin_email, "password": s.admin_password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


async def place_order(c, country="NG", qty=1, email="ada@example.com"):
    body = {
        "email": email, "full_name": "Ada Okafor",
        "shipping_address": {"line1": "12 Admiralty Way", "city": "Lagos", "country": country},
        "items": [{"slug": SLUG, "size": "42", "quantity": qty}],
    }
    r = await c.post("/api/orders", json=body)
    assert r.status_code == 201, r.text
    return r.json()["order"]


# ---------- dashboard ----------
async def test_stats_reports_trend_and_best_sellers(client):
    h = await headers(client)
    order = await place_order(client)
    await client.post(f"/api/orders/{order['order_number']}/demo-pay", json={"email": "ada@example.com"})

    r = await client.get("/api/admin/stats", headers=h)
    assert r.status_code == 200, r.text
    s = r.json()
    assert s["period"]["orders"] == 1
    assert s["period"]["revenue_cents"] == s["revenue_cents"] > 0
    assert s["period"]["avg_order_cents"] == s["revenue_cents"]
    assert s["top_products"][0]["slug"] == SLUG
    assert len(s["series"]) == s["window_days"] + 1
    assert sum(d["revenue_cents"] for d in s["series"]) == s["revenue_cents"]
    assert s["products_total"] == s["products_active"] == 9


async def test_stats_ignores_unpaid_orders(client):
    h = await headers(client)
    await place_order(client)  # left pending_payment
    s = (await client.get("/api/admin/stats", headers=h)).json()
    assert s["period"]["revenue_cents"] == 0 and s["period"]["orders"] == 0
    assert s["counts"]["pending_payment"] == 1


# ---------- products ----------
async def test_product_create_update_delete(client):
    h = await headers(client)
    body = {
        "slug": "regent-suede-loafers", "name": "Regent", "line": "Regent", "category": "Velvet loafers",
        "description": "A test pair.", "price_cents": 21000,
        "colour": {"name": "Sand suede", "hex": "#C8A97E"},
        "images": ["https://cdn.test/a.png"], "sizes": [{"size": "42", "stock": 3}],
    }
    r = await client.post("/api/admin/products", json=body, headers=h)
    assert r.status_code == 201, r.text
    assert r.json()["slug"] == "regent-suede-loafers"

    dupe = await client.post("/api/admin/products", json=body, headers=h)
    assert dupe.status_code == 409

    r = await client.patch("/api/admin/products/regent-suede-loafers",
                           json={"name": "Regent II", "price_cents": 23000}, headers=h)
    assert r.status_code == 200
    assert (r.json()["name"], r.json()["price_cents"]) == ("Regent II", 23000)
    assert r.json()["description"] == "A test pair."  # untouched fields survive a partial save

    # It reaches the storefront, then stops when deleted.
    assert (await client.get("/api/products/regent-suede-loafers")).status_code == 200
    assert (await client.delete("/api/admin/products/regent-suede-loafers", headers=h)).status_code == 200
    assert (await client.get("/api/products/regent-suede-loafers")).status_code == 404
    assert (await client.delete("/api/admin/products/regent-suede-loafers", headers=h)).status_code == 404


async def test_badge_clears_with_empty_string(client):
    h = await headers(client)
    slug = "royal-crested-black-velvet-loafers"
    assert (await client.get(f"/api/admin/products/{slug}", headers=h)).json()["badge"] == "Best seller"
    r = await client.patch(f"/api/admin/products/{slug}", json={"badge": ""}, headers=h)
    assert r.json()["badge"] is None


async def test_create_rejects_a_bad_slug(client):
    h = await headers(client)
    r = await client.post("/api/admin/products", json={
        "slug": "Not A Slug", "name": "X", "line": "X", "category": "X", "price_cents": 100,
        "colour": {"name": "x", "hex": "#000"},
    }, headers=h)
    assert r.status_code == 422


# ---------- images ----------
async def test_image_crud_round_trip(client):
    h = await headers(client)
    start = (await client.get(f"/api/admin/products/{SLUG}/images", headers=h)).json()["images"]
    assert len(start) == 5

    added = await client.post(f"/api/admin/products/{SLUG}/images",
                              json={"url": "https://cdn.test/new.png"}, headers=h)
    assert added.status_code == 201
    assert added.json()["images"][-1] == "https://cdn.test/new.png"

    again = await client.post(f"/api/admin/products/{SLUG}/images",
                              json={"url": "https://cdn.test/new.png"}, headers=h)
    assert again.status_code == 409  # no duplicates in one gallery

    # Reordering is a whole-gallery write; index 0 becomes the card image.
    reordered = list(reversed(added.json()["images"]))
    r = await client.put(f"/api/admin/products/{SLUG}/images", json={"images": reordered}, headers=h)
    assert r.json()["images"] == reordered
    assert (await client.get(f"/api/products/{SLUG}")).json()["images"][0] == reordered[0]

    r = await client.delete(f"/api/admin/products/{SLUG}/images/0", headers=h)
    assert r.json()["images"] == reordered[1:]
    assert (await client.delete(f"/api/admin/products/{SLUG}/images/99", headers=h)).status_code == 404


async def test_uploads_are_off_without_storage_configured(client):
    h = await headers(client)
    status = (await client.get("/api/admin/media/status", headers=h)).json()
    assert status["uploads_enabled"] is False and "MEDIA_STORAGE" in status["reason"]


# ---------- customers ----------
async def test_customers_summarise_their_orders(client):
    h = await headers(client)
    first = await place_order(client, qty=1)
    await client.post(f"/api/orders/{first['order_number']}/demo-pay", json={"email": "ada@example.com"})
    await place_order(client, qty=2)  # left unpaid
    await place_order(client, email="bode@example.com")

    r = await client.get("/api/admin/customers", headers=h)
    assert r.status_code == 200, r.text
    rows = {c["email"]: c for c in r.json()["customers"]}
    assert r.json()["total"] == 2
    ada = rows["ada@example.com"]
    assert ada["orders"] == 2 and ada["paid_orders"] == 1
    assert ada["spent_cents"] == first["total_cents"]  # unpaid orders don't count as spend
    assert ada["country"] == "NG"

    detail = await client.get("/api/admin/customers/ada@example.com", headers=h)
    assert detail.status_code == 200
    assert len(detail.json()["order_history"]) == 2
    assert len(detail.json()["addresses"]) == 1  # the same address isn't listed twice

    assert (await client.get("/api/admin/customers/nobody@example.com", headers=h)).status_code == 404


async def test_customer_search_filters(client):
    h = await headers(client)
    await place_order(client, email="ada@example.com")
    await place_order(client, email="bode@example.com")
    r = await client.get("/api/admin/customers", params={"q": "bode"}, headers=h)
    assert [c["email"] for c in r.json()["customers"]] == ["bode@example.com"]


# ---------- shipping ----------
def test_quote_picks_the_zone_for_the_country():
    shipping = {
        "zones": [{"id": "ng", "name": "Nigeria", "countries": ["NG"], "rate_cents": 1500, "free_over_cents": 25000}],
        "default_rate_cents": 6000, "default_free_over_cents": 90000,
    }
    assert quote_shipping(shipping, 10000, "NG")["cents"] == 1500
    assert quote_shipping(shipping, 10000, "ng")["cents"] == 1500  # case doesn't matter
    assert quote_shipping(shipping, 30000, "NG")["cents"] == 0  # over that zone's free threshold
    assert quote_shipping(shipping, 30000, "US")["cents"] == 6000  # unmatched -> default
    assert quote_shipping(shipping, 95000, "US")["cents"] == 0
    assert quote_shipping(shipping, 10000, None)["zone"] == "Rest of world"


async def test_admin_can_change_rates_and_checkout_charges_them(client):
    h = await headers(client)
    r = await client.put("/api/admin/settings/shipping", headers=h, json={
        "zones": [{"id": "lagos", "name": "Lagos", "countries": ["NG"], "rate_cents": 500, "free_over_cents": None}],
        "default_rate_cents": 7000, "default_free_over_cents": None,
    })
    assert r.status_code == 200, r.text

    ng = await place_order(client, country="NG")
    assert ng["shipping_cents"] == 500
    row = await client.get(f"/api/admin/orders/{ng['order_number']}", headers=h)
    assert row.json()["shipping_zone"] == "Lagos"

    us = await place_order(client, country="US")
    assert us["shipping_cents"] == 7000

    cfg = (await client.get("/api/config")).json()
    assert cfg["shipping_flat_cents"] == 7000
    assert [z["name"] for z in cfg["shipping_zones"]] == ["Lagos"]


async def test_a_country_cannot_sit_in_two_zones(client):
    h = await headers(client)
    r = await client.put("/api/admin/settings/shipping", headers=h, json={
        "zones": [
            {"id": "a", "name": "Zone A", "countries": ["NG"], "rate_cents": 100},
            {"id": "b", "name": "Zone B", "countries": ["ng"], "rate_cents": 200},
        ],
        "default_rate_cents": 5000,
    })
    assert r.status_code == 422
    assert "one zone" in r.json()["detail"]


async def test_public_shipping_quote_endpoint(client):
    r = await client.get("/api/shipping/quote", params={"country": "NG", "subtotal_cents": 10000})
    assert r.status_code == 200
    assert r.json()["zone"] == "Nigeria" and r.json()["cents"] == 1500


# ---------- auth ----------
@pytest.mark.parametrize("method,path", [
    ("get", "/api/admin/stats"), ("get", "/api/admin/customers"), ("get", "/api/admin/settings"),
    ("post", "/api/admin/products"), ("delete", f"/api/admin/products/{SLUG}"),
    ("put", f"/api/admin/products/{SLUG}/images"), ("get", "/api/admin/media/status"),
])
async def test_admin_routes_need_a_token(client, method, path):
    r = await getattr(client, method)(path, **({"json": {}} if method in ("post", "put") else {}))
    assert r.status_code in (401, 403)
