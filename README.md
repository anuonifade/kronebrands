# Kronebrands — storefront + fulfilment admin

React (Vite) storefront, FastAPI backend, MongoDB. Customers browse, add to bag and check
out; orders land in an admin queue where staff prepare, ship (with tracking) and deliver them.

## Run it

### Docker (everything)
```bash
cp backend/.env.example backend/.env      # set JWT_SECRET and ADMIN_PASSWORD
docker compose up --build
```
Store: http://localhost:8080 · Admin: http://localhost:8080/admin · API docs: http://localhost:8000/docs

### Local dev
```bash
# 1. MongoDB on :27017 (e.g. `docker run -p 27017:27017 mongo:7`)
# 2. Backend
cd backend && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt && cp .env.example .env
uvicorn app.main:app --reload            # seeds products + admin user on first start
# 3. Frontend (proxies /api to :8000)
cd frontend && npm install && npm run dev   # http://localhost:5173
```
Tests: `cd backend && pytest` (runs against an in-memory Mongo, no server needed).

## Payments
* **Demo mode (default, `STRIPE_SECRET_KEY` empty):** placing an order reserves stock and
  marks it paid without charging anything, so you can walk the whole purchase → fulfil flow.
  The checkout page says so. The `/demo-pay` endpoint switches itself off once Stripe is set.
* **Stripe:** set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`, and point a webhook at
  `POST /api/payments/stripe/webhook` for `checkout.session.completed` and
  `checkout.session.expired`. Customers are redirected to Stripe Checkout; card data never
  touches this app. Expired sessions cancel the order and return stock.

## Order lifecycle
`pending_payment → paid → processing → shipped → delivered`, with `cancelled` allowed until
shipping. Transitions are enforced server-side (`ALLOWED_TRANSITIONS` in `app/models.py`);
shipping requires a tracking number; every change is written to the order's timeline with
the admin's email. Cancelling restocks. Customers can track orders at `/order-status` with
their order number + email.

Prices are always recomputed from the catalogue on the server, and stock is reserved per
size with an atomic conditional update, so two customers can't buy the last pair.

## Admin
Five sections behind `/admin`, all on one JWT:

* **Overview** — revenue for the last 7/30/90 days with a daily trend, orders and average
  order value, the fulfilment pipeline, best sellers, what needs restocking and the latest
  orders. `GET /api/admin/stats?days=` returns the lot in two round trips.
* **Orders** — the fulfilment queue, unchanged: filter by status, search, and walk an order
  through the lifecycle.
* **Customers** — derived from orders, since the store has no sign-up. Each row is one email
  with what they've spent, how often, where they ship and what they last bought; open one for
  their full order history, every address they've used and a tally of the pairs they own.
* **Products** — create, edit and delete, with stock per size, price, copy, colour and
  visibility. Deleting only removes the catalogue entry: past orders keep their own copy of
  each line, so history survives.
* **Settings** — shipping zones (below) and whether image uploads are configured.

### Product images
The gallery editor shows every shot a product has, in the order customers scroll them.
Drag to reorder, or use the arrows for keyboard access; the first image is the hero and is
what the shop, bag and search results use. Add by URL, or drop files in when object storage
is configured. Removing an image takes it out of that product's gallery and leaves the file
in storage, because the same URL may be used by another product or a past order.

### Shipping
Rates live in the database and are edited in Admin → Settings, not in env vars. A zone is a
name, a list of ISO-2 country codes, a rate and an optional free-shipping threshold; the
first zone listing the destination country wins, so order zones most-specific first. Anything
unmatched pays the default rate. A country can only belong to one zone — the API rejects
overlaps. The settings screen has a basket tester that calls the same quote checkout uses.
`SHIPPING_FLAT_CENTS` / `FREE_SHIPPING_THRESHOLD_CENTS` now only seed the defaults on first run.

### Image uploads (optional)
Uploads are off until you point `MEDIA_STORAGE` at a provider; until then admins add images
by URL, which is all the seeded catalogue needs.

```bash
MEDIA_STORAGE=s3                 # any S3-compatible bucket
S3_BUCKET=kronebrands-media
S3_REGION=eu-west-1
S3_PUBLIC_BASE_URL=https://cdn.example.com   # optional CDN in front of the bucket
S3_ENDPOINT_URL=                 # set for R2 / Spaces / MinIO, empty for AWS
AWS_ACCESS_KEY_ID=… AWS_SECRET_ACCESS_KEY=…

MEDIA_STORAGE=cloudinary         # or Cloudinary instead
CLOUDINARY_CLOUD_NAME=… CLOUDINARY_API_KEY=… CLOUDINARY_API_SECRET=…
```
JPEG, PNG, WebP and AVIF up to `MAX_UPLOAD_BYTES` (10MB default).

## API
| Method | Path | |
|---|---|---|
| GET | `/api/products?category=&line=&sort=` | catalogue |
| GET | `/api/products/{slug}` | product + other colourways |
| POST | `/api/orders` | checkout (returns `checkout_url` in Stripe mode) |
| GET | `/api/orders/lookup?number=&email=` | customer order status |
| GET | `/api/shipping/quote?country=&subtotal_cents=` | live shipping cost for checkout |
| POST | `/api/admin/login` | JWT for admin |
| GET | `/api/admin/stats?days=` | dashboard: trend, totals, best sellers, low stock |
| GET | `/api/admin/orders?status=&q=&page=` | fulfilment queue |
| POST | `/api/admin/orders/{number}/status` | prepare / ship / deliver / cancel |
| GET | `/api/admin/customers?q=&sort=&page=` | customers built from orders |
| GET | `/api/admin/customers/{email}` | one customer + full history |
| GET/POST | `/api/admin/products` | list / create |
| GET/PATCH/DELETE | `/api/admin/products/{slug}` | read / edit / remove |
| GET/PUT | `/api/admin/products/{slug}/images` | read gallery / replace + reorder |
| POST/DELETE | `/api/admin/products/{slug}/images[/{index}]` | add one / remove one |
| POST | `/api/admin/media` | upload an image to object storage |
| GET/PUT | `/api/admin/settings[/shipping]` | read settings / save shipping zones |

## Brand media
All product shots, the hero, the editorial and atelier images and the videos were generated
with Higgsfield (Nano Banana Pro and Seedance 2.0), anchored on a photograph of a real
crested pair so every shoe carries the Krone crest — gold bullion crown on a black oval.
URLs live in `frontend/src/lib/media.js` and `backend/app/media.py`. They're hosted on
Higgsfield's CDN: **copy them into your own storage before launch.** The product shots are
AI renderings styled on the real range, so swap in real photography for any detail that must
be exact (stitching, crest, sole).

`SHOTS` in `backend/app/media.py` holds five angles per style, in gallery order: three-quarter
hero, outer side profile, top-down pair, heel three-quarter, and a macro of the crest. Shot 0
doubles as the card image on the shop, home page and bag, so keep the hero first.

To add a new product, add it to `backend/app/seed.py` and run `python -m app.seed`
(or `--force` to overwrite existing entries). Seeding runs on every backend start and
**re-applies `images` and `video` to products that already exist**, so re-shot photography
reaches a live catalogue without `--force`; stock, price and visibility stay as the admin
left them. Use `--force` only to reset everything else (copy, colours, stock) back to the file.

## Structure
```
backend/app/   main.py · config.py · db.py · models.py · auth.py · orders_service.py · seed.py · media.py
               routers/{products,orders,admin}.py
backend/tests/ test_flow.py
frontend/src/  pages/ (Home, Shop, Product, Checkout, Order, OrderStatus, About)
               admin/ (Login, Layout, Orders, OrderDetail, Products)
               components/ (AnnouncementBar, Header + mega menu, VelvetRoom, LoopVideo, CartDrawer…)
```
