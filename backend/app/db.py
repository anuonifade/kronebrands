from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from .config import get_settings

_client: AsyncIOMotorClient | None = None
_db: AsyncIOMotorDatabase | None = None


def set_db(db: AsyncIOMotorDatabase) -> None:
    """Lets tests inject a mock database."""
    global _db
    _db = db


def get_db() -> AsyncIOMotorDatabase:
    global _client, _db
    if _db is None:
        s = get_settings()
        _client = AsyncIOMotorClient(s.mongo_url)
        _db = _client[s.mongo_db]
    return _db


async def ensure_indexes(db: AsyncIOMotorDatabase) -> None:
    await db.products.create_index("slug", unique=True)
    await db.products.create_index("line")
    await db.orders.create_index("order_number", unique=True)
    await db.orders.create_index([("status", 1), ("created_at", -1)])
    await db.orders.create_index("email")
    await db.admins.create_index("email", unique=True)
