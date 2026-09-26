from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, conint


class OrderStatus(str, Enum):
    pending_payment = "pending_payment"
    paid = "paid"
    processing = "processing"
    shipped = "shipped"
    delivered = "delivered"
    cancelled = "cancelled"


# Which statuses an admin may move an order to from each status.
ALLOWED_TRANSITIONS: dict[OrderStatus, set[OrderStatus]] = {
    OrderStatus.pending_payment: {OrderStatus.cancelled},
    OrderStatus.paid: {OrderStatus.processing, OrderStatus.shipped, OrderStatus.cancelled},
    OrderStatus.processing: {OrderStatus.shipped, OrderStatus.cancelled},
    OrderStatus.shipped: {OrderStatus.delivered},
    OrderStatus.delivered: set(),
    OrderStatus.cancelled: set(),
}


# ---------- Products ----------
class SizeStock(BaseModel):
    size: str
    stock: conint(ge=0) = 0


class Colour(BaseModel):
    name: str
    hex: str


class Product(BaseModel):
    slug: str
    name: str
    line: str
    category: str
    description: str
    price_cents: int
    currency: str = "USD"
    colour: Colour
    images: list[str]
    video: Optional[str] = None
    sizes: list[SizeStock]
    badge: Optional[str] = None
    featured: bool = False
    active: bool = True


SLUG_RE = r"^[a-z0-9]+(?:-[a-z0-9]+)*$"


class ProductCreate(BaseModel):
    slug: str = Field(pattern=SLUG_RE, max_length=120)
    name: str = Field(min_length=1, max_length=120)
    line: str = Field(min_length=1, max_length=60)
    category: str = Field(min_length=1, max_length=60)
    description: str = ""
    price_cents: conint(gt=0)
    colour: Colour
    images: list[str] = []
    video: Optional[str] = None
    sizes: list[SizeStock] = []
    badge: Optional[str] = None
    featured: bool = False
    active: bool = True


class ProductUpdate(BaseModel):
    """Every field an admin may edit. Only what's sent is written, so a partial
    save never clears the rest — but `None` is meaningful for the optional fields,
    which is why they're cleared with an explicit empty string instead."""

    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    line: Optional[str] = Field(default=None, min_length=1, max_length=60)
    category: Optional[str] = Field(default=None, min_length=1, max_length=60)
    description: Optional[str] = None
    price_cents: Optional[conint(gt=0)] = None
    colour: Optional[Colour] = None
    images: Optional[list[str]] = None
    video: Optional[str] = None
    active: Optional[bool] = None
    featured: Optional[bool] = None
    badge: Optional[str] = None
    sizes: Optional[list[SizeStock]] = None


class ImagesIn(BaseModel):
    """The whole gallery, in display order. Index 0 is the shot used on cards."""

    images: list[str] = Field(max_length=24)


class ImageIn(BaseModel):
    url: str = Field(min_length=4, max_length=2000)
    position: Optional[int] = None  # default: appended to the end


# ---------- Store settings ----------
class ShippingZone(BaseModel):
    id: str = Field(pattern=SLUG_RE, max_length=60)
    name: str = Field(min_length=1, max_length=60)
    countries: list[str] = Field(default_factory=list)
    rate_cents: conint(ge=0)
    free_over_cents: Optional[conint(ge=0)] = None


class ShippingIn(BaseModel):
    zones: list[ShippingZone] = Field(default_factory=list, max_length=40)
    default_rate_cents: conint(ge=0)
    default_free_over_cents: Optional[conint(ge=0)] = None


# ---------- Orders ----------
class CartItemIn(BaseModel):
    slug: str
    size: str
    quantity: conint(ge=1, le=10)


class Address(BaseModel):
    line1: str = Field(min_length=2)
    line2: Optional[str] = None
    city: str = Field(min_length=1)
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country: str = Field(min_length=2)


class CheckoutIn(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=2)
    phone: Optional[str] = None
    shipping_address: Address
    items: list[CartItemIn] = Field(min_length=1)
    note: Optional[str] = None


class StatusUpdateIn(BaseModel):
    status: OrderStatus
    note: Optional[str] = None
    carrier: Optional[str] = None
    tracking_number: Optional[str] = None


class LoginIn(BaseModel):
    email: EmailStr
    password: str


def serialize(doc: dict) -> dict:
    """Mongo document -> JSON-safe dict."""
    if doc is None:
        return doc
    out = {k: v for k, v in doc.items() if k != "_id"}
    out["id"] = str(doc.get("_id"))
    for k, v in list(out.items()):
        if isinstance(v, datetime):
            out[k] = v.isoformat()
    return out
