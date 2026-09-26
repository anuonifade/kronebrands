from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .db import ensure_indexes, get_db
from .routers import admin, admin_catalog, orders, products
from .seed import seed


@asynccontextmanager
async def lifespan(app: FastAPI):
    db = get_db()
    await ensure_indexes(db)
    await seed(db)  # idempotent: inserts missing products + the admin account
    yield


app = FastAPI(title="Kronebrands API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in get_settings().cors_origins.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(products.router)
app.include_router(orders.router)
app.include_router(admin.router)
app.include_router(admin_catalog.router)


@app.get("/api/health")
async def health():
    return {"ok": True}
