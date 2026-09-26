import pytest
from httpx import ASGITransport, AsyncClient
from mongomock_motor import AsyncMongoMockClient

from app import db as dbmod
from app.config import get_settings
from app.main import app
from app.seed import seed

SLUG = "royal-crested-magenta-velvet-loafers"


@pytest.fixture
async def client():
    mock = AsyncMongoMockClient()["kb_test"]
    dbmod.set_db(mock)
    await seed(mock, force=True)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c:
        yield c


def checkout_body(qty=1, size="42"):
    return {
        "email": "Ada@Example.com",
        "full_name": "Ada Okafor",
        "shipping_address": {"line1": "12 Admiralty Way", "city": "Lagos", "country": "NG"},
        "items": [{"slug": SLUG, "size": size, "quantity": qty}],
    }


async def admin_headers(c):
    s = get_settings()
    r = await c.post("/api/admin/login", json={"email": s.admin_email, "password": s.admin_password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


async def stock(c, size="42"):
    p = (await c.get(f"/api/products/{SLUG}")).json()
    return next(s["stock"] for s in p["sizes"] if s["size"] == size)


async def test_catalogue(client):
    r = await client.get("/api/products")
    assert r.status_code == 200 and len(r.json()) == 9
    p = (await client.get(f"/api/products/{SLUG}")).json()
    assert len(p["colourways"]) == 4


async def test_purchase_and_fulfil(client):
    before = await stock(client)
    r = await client.post("/api/orders", json=checkout_body(qty=2))
    assert r.status_code == 201, r.text
    order = r.json()["order"]
    num = order["order_number"]
    assert order["total_cents"] == 50000 and order["shipping_cents"] == 0  # free over $500
    assert await stock(client) == before - 2

    r = await client.post(f"/api/orders/{num}/demo-pay", json={"email": "ada@example.com"})
    assert r.json()["status"] == "paid"

    h = await admin_headers(client)
    assert (await client.get("/api/admin/orders", headers=h, params={"status": "paid"})).json()["total"] == 1
    assert (await client.get("/api/admin/stats", headers=h)).json()["to_fulfil"] == 1

    r = await client.post(f"/api/admin/orders/{num}/status", headers=h, json={"status": "shipped"})
    assert r.status_code == 422  # tracking required
    r = await client.post(f"/api/admin/orders/{num}/status", headers=h,
                          json={"status": "shipped", "carrier": "DHL", "tracking_number": "JD0142"})
    assert r.status_code == 200 and r.json()["fulfillment"]["tracking_number"] == "JD0142"
    r = await client.post(f"/api/admin/orders/{num}/status", headers=h, json={"status": "delivered"})
    assert r.json()["status"] == "delivered"
    r = await client.post(f"/api/admin/orders/{num}/status", headers=h, json={"status": "cancelled"})
    assert r.status_code == 409

    lk = await client.get("/api/orders/lookup", params={"number": num.lower(), "email": "ADA@example.com"})
    assert lk.status_code == 200 and len(lk.json()["timeline"]) == 4


async def test_out_of_stock_rolls_back(client):
    before = await stock(client, "40")
    body = checkout_body(qty=1, size="40")
    body["items"].append({"slug": "sovereign-oxford-brogues", "size": "41", "quantity": 10})
    r = await client.post("/api/orders", json=body)
    assert r.status_code == 409
    assert await stock(client, "40") == before  # first line released


async def test_cancel_restocks_and_admin_auth(client):
    assert (await client.get("/api/admin/orders")).status_code == 401
    before = await stock(client)
    num = (await client.post("/api/orders", json=checkout_body())).json()["order"]["order_number"]
    h = await admin_headers(client)
    r = await client.post(f"/api/admin/orders/{num}/status", headers=h, json={"status": "cancelled"})
    assert r.status_code == 200
    assert await stock(client) == before
