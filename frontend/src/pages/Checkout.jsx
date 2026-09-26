import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useCart } from "../lib/cart";
import { money } from "../lib/format";

const EMPTY = { email: "", full_name: "", phone: "", line1: "", line2: "", city: "", state: "", postal_code: "", country: "NG" };

export default function Checkout() {
  const { items, subtotal, clear } = useCart();
  const [form, setForm] = useState(EMPTY);
  const [cfg, setCfg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const nav = useNavigate();

  useEffect(() => { api.config().then(setCfg).catch(() => {}); }, []);

  const shipping = cfg ? (subtotal >= cfg.free_shipping_threshold_cents ? 0 : cfg.shipping_flat_cents) : null;
  const upd = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const { email, full_name, phone, ...addr } = form;
      const res = await api.createOrder({
        email, full_name, phone: phone || null,
        shipping_address: addr,
        items: items.map(({ slug, size, quantity }) => ({ slug, size, quantity })),
      });
      if (res.checkout_url) {
        clear();
        window.location.assign(res.checkout_url); // Stripe Checkout
        return;
      }
      // Demo mode: simulate a successful payment so the order reaches the admin queue.
      await api.demoPay(res.order.order_number, email);
      clear();
      nav(`/order/${res.order.order_number}?email=${encodeURIComponent(email)}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!items.length) {
    return <div className="page narrow"><h1 className="h2">Your bag is empty</h1><Link className="btn" to="/shop">Browse the collection</Link></div>;
  }

  return (
    <div className="page checkout">
      <form className="checkout__form" onSubmit={submit}>
        <h1 className="display display--md">Checkout</h1>

        <fieldset>
          <legend>Contact</legend>
          <Field label="Email" type="email" value={form.email} onChange={upd("email")} required autoComplete="email" />
          <Field label="Full name" value={form.full_name} onChange={upd("full_name")} required autoComplete="name" />
          <Field label="Phone (for the courier)" value={form.phone} onChange={upd("phone")} autoComplete="tel" />
        </fieldset>

        <fieldset>
          <legend>Shipping address</legend>
          <Field label="Address" value={form.line1} onChange={upd("line1")} required autoComplete="address-line1" />
          <Field label="Apartment, suite (optional)" value={form.line2} onChange={upd("line2")} autoComplete="address-line2" />
          <div className="two">
            <Field label="City" value={form.city} onChange={upd("city")} required autoComplete="address-level2" />
            <Field label="State" value={form.state} onChange={upd("state")} autoComplete="address-level1" />
          </div>
          <div className="two">
            <Field label="Postal code" value={form.postal_code} onChange={upd("postal_code")} autoComplete="postal-code" />
            <label className="field">
              <span>Country</span>
              <select value={form.country} onChange={upd("country")} autoComplete="country">
                <option value="NG">Nigeria</option><option value="GH">Ghana</option><option value="GB">United Kingdom</option>
                <option value="US">United States</option><option value="CA">Canada</option><option value="ZA">South Africa</option>
                <option value="AE">United Arab Emirates</option>
              </select>
            </label>
          </div>
        </fieldset>

        {cfg?.payments_mode === "demo" && (
          <p className="notice small">Test mode: no card is charged. Placing the order marks it paid so it appears in the admin fulfilment queue.</p>
        )}
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn btn--block" disabled={busy}>
          {busy ? "Placing order…" : cfg?.payments_mode === "stripe" ? "Continue to payment" : `Place order, ${money(subtotal + (shipping || 0))}`}
        </button>
      </form>

      <aside className="summary" aria-label="Order summary">
        <ul>
          {items.map((l) => (
            <li key={l.slug + l.size} className="line">
              <img src={l.image} alt="" />
              <div><p className="line__name">{l.name} × {l.quantity}</p><p className="muted small">{l.colour}, EU {l.size}</p></div>
              <p>{money(l.price_cents * l.quantity)}</p>
            </li>
          ))}
        </ul>
        <div className="row"><span>Subtotal</span><span>{money(subtotal)}</span></div>
        <div className="row"><span>Shipping</span><span>{shipping === null ? "…" : shipping === 0 ? "Free" : money(shipping)}</span></div>
        <div className="row row--total"><span>Total</span><span>{money(subtotal + (shipping || 0))}</span></div>
      </aside>
    </div>
  );
}

function Field({ label, ...props }) {
  return <label className="field"><span>{label}</span><input {...props} /></label>;
}
