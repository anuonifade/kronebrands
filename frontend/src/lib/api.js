const BASE = import.meta.env.VITE_API_URL || "";
const TOKEN_KEY = "kb_admin_token";

export const adminToken = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, { method = "GET", body, admin = false, params } = {}) {
  const url = new URL(BASE + path, window.location.origin);
  if (params) Object.entries(params).forEach(([k, v]) => v !== undefined && v !== "" && url.searchParams.set(k, v));
  const headers = { "Content-Type": "application/json" };
  if (admin && adminToken.get()) headers.Authorization = `Bearer ${adminToken.get()}`;
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && admin) adminToken.clear();
    const detail = Array.isArray(data.detail)
      ? data.detail.map((d) => `${d.loc?.slice(-1)[0]}: ${d.msg}`).join(", ")
      : data.detail;
    throw new ApiError(detail || `Request failed (${res.status})`, res.status);
  }
  return data;
}

/** Multipart upload — the only call that isn't JSON. */
async function upload(path, file) {
  const form = new FormData();
  form.append("file", file);
  const headers = {};
  if (adminToken.get()) headers.Authorization = `Bearer ${adminToken.get()}`;
  const res = await fetch(new URL(BASE + path, window.location.origin), { method: "POST", headers, body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.detail || `Upload failed (${res.status})`, res.status);
  return data;
}

export const api = {
  config: () => request("/api/config"),
  products: (params) => request("/api/products", { params }),
  product: (slug) => request(`/api/products/${slug}`),
  createOrder: (body) => request("/api/orders", { method: "POST", body }),
  demoPay: (num, email) => request(`/api/orders/${num}/demo-pay`, { method: "POST", body: { email } }),
  lookup: (number, email) => request("/api/orders/lookup", { params: { number, email } }),
  shippingQuote: (country, subtotal_cents) => request("/api/shipping/quote", { params: { country, subtotal_cents } }),

  admin: {
    login: (email, password) => request("/api/admin/login", { method: "POST", body: { email, password } }),
    me: () => request("/api/admin/me", { admin: true }),
    stats: (params) => request("/api/admin/stats", { admin: true, params }),

    orders: (params) => request("/api/admin/orders", { admin: true, params }),
    order: (num) => request(`/api/admin/orders/${num}`, { admin: true }),
    setStatus: (num, body) => request(`/api/admin/orders/${num}/status`, { method: "POST", body, admin: true }),

    customers: (params) => request("/api/admin/customers", { admin: true, params }),
    customer: (email) => request(`/api/admin/customers/${encodeURIComponent(email)}`, { admin: true }),

    products: (params) => request("/api/admin/products", { admin: true, params }),
    product: (slug) => request(`/api/admin/products/${slug}`, { admin: true }),
    createProduct: (body) => request("/api/admin/products", { method: "POST", body, admin: true }),
    updateProduct: (slug, body) => request(`/api/admin/products/${slug}`, { method: "PATCH", body, admin: true }),
    deleteProduct: (slug) => request(`/api/admin/products/${slug}`, { method: "DELETE", admin: true }),
    lines: () => request("/api/admin/lines", { admin: true }),

    images: (slug) => request(`/api/admin/products/${slug}/images`, { admin: true }),
    setImages: (slug, images) => request(`/api/admin/products/${slug}/images`, { method: "PUT", body: { images }, admin: true }),
    addImage: (slug, url) => request(`/api/admin/products/${slug}/images`, { method: "POST", body: { url }, admin: true }),
    removeImage: (slug, index) => request(`/api/admin/products/${slug}/images/${index}`, { method: "DELETE", admin: true }),
    mediaStatus: () => request("/api/admin/media/status", { admin: true }),
    uploadImage: (file) => upload("/api/admin/media", file),

    settings: () => request("/api/admin/settings", { admin: true }),
    saveShipping: (body) => request("/api/admin/settings/shipping", { method: "PUT", body, admin: true }),
    previewShipping: (params) => request("/api/admin/settings/shipping/preview", { admin: true, params }),
  },
};
