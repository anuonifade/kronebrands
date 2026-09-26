import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { dateTime, money, statusLabel } from "../lib/format";

export default function AdminOrderDetail() {
  const { number } = useParams();
  const [o, setO] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ship, setShip] = useState({ carrier: "DHL", tracking_number: "", note: "" });
  const [flash, setFlash] = useState("");

  useEffect(() => { api.admin.order(number).then(setO).catch((e) => setError(e.message)); }, [number]);

  const move = async (status, extra = {}) => {
    if (status === "cancelled" && !window.confirm("Cancel this order? Stock will be returned to inventory.")) return;
    setBusy(true); setError(""); setFlash("");
    try {
      const updated = await api.admin.setStatus(number, { status, ...extra });
      setO(updated);
      setFlash(`Marked ${statusLabel[status].toLowerCase()}.`);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  if (!o) return error ? <p className="error">{error}</p> : <p className="muted">Loading…</p>;
  const a = o.shipping_address;

  return (
    <div className="aod">
      <Link className="linkbtn" to="/admin/orders">← All orders</Link>
      <div className="aod__head">
        <h1 className="h2">{o.order_number}</h1>
        <span className={`pill pill--${o.status}`}>{statusLabel[o.status]}</span>
      </div>
      {flash && <p className="notice" role="status">{flash}</p>}
      {error && <p className="error" role="alert">{error}</p>}

      <section className="panel">
        <h2 className="panel__h">Fulfil</h2>
        {o.status === "paid" && (
          <p><button className="btn btn--ghost" disabled={busy} onClick={() => move("processing")}>Start preparing</button></p>
        )}
        {(o.status === "paid" || o.status === "processing") && (
          <form className="ship" onSubmit={(e) => { e.preventDefault(); move("shipped", ship); }}>
            <label className="field"><span>Carrier</span>
              <select value={ship.carrier} onChange={(e) => setShip({ ...ship, carrier: e.target.value })}>
                <option>DHL</option><option>GIG Logistics</option><option>FedEx</option><option>UPS</option><option>Local rider</option>
              </select>
            </label>
            <label className="field"><span>Tracking number</span>
              <input required value={ship.tracking_number} onChange={(e) => setShip({ ...ship, tracking_number: e.target.value })} />
            </label>
            <label className="field"><span>Note (optional)</span>
              <input value={ship.note} onChange={(e) => setShip({ ...ship, note: e.target.value })} />
            </label>
            <button className="btn" disabled={busy}>Mark shipped</button>
          </form>
        )}
        {o.status === "shipped" && (
          <p>Shipped with {o.fulfillment.carrier}, tracking <strong>{o.fulfillment.tracking_number}</strong>.{" "}
            <button className="btn" disabled={busy} onClick={() => move("delivered")}>Mark delivered</button></p>
        )}
        {o.status === "delivered" && <p className="muted">Delivered {dateTime(o.fulfillment.delivered_at)}. Nothing left to do.</p>}
        {o.status === "pending_payment" && <p className="muted">Waiting for payment. Only paid orders can be fulfilled.</p>}
        {["pending_payment", "paid", "processing"].includes(o.status) && (
          <button className="linkbtn danger" disabled={busy} onClick={() => move("cancelled")}>Cancel order</button>
        )}
      </section>

      <div className="aod__grid">
        <section className="panel">
          <h2 className="panel__h">Items to pick</h2>
          <ul>
            {o.items.map((l) => (
              <li key={l.slug + l.size} className="line">
                <img src={l.image} alt="" />
                <div><p className="line__name">{l.name} × {l.quantity}</p><p className="muted small">{l.colour}, EU {l.size}</p></div>
                <p>{money(l.unit_price_cents * l.quantity)}</p>
              </li>
            ))}
          </ul>
          <div className="row">
            <span>Shipping{o.shipping_zone && <span className="muted small"> · {o.shipping_zone}</span>}</span>
            <span>{o.shipping_cents === 0 ? "Free" : money(o.shipping_cents)}</span>
          </div>
          <div className="row row--total"><span>Total</span><span>{money(o.total_cents)}</span></div>
          <p className="small muted">Payment: {o.payment.provider}, {o.payment.status}{o.payment.reference ? ` (${o.payment.reference})` : ""}</p>
        </section>

        <section className="panel">
          <h2 className="panel__h">Ship to</h2>
          <p>{o.full_name}<br />{a.line1}{a.line2 && <><br />{a.line2}</>}<br />{a.city}{a.state && `, ${a.state}`} {a.postal_code}<br />{a.country}</p>
          <p><a href={`mailto:${o.email}`}>{o.email}</a>{o.phone && <><br />{o.phone}</>}</p>
          <p><Link className="linkbtn" to={`/admin/customers/${encodeURIComponent(o.email)}`}>See everything they've ordered →</Link></p>
          {o.note && <p className="notice small">Customer note: {o.note}</p>}
          <h2 className="panel__h">History</h2>
          <ul className="timeline">
            {o.timeline.map((t, i) => (
              <li key={i}><span>{statusLabel[t.status]}</span> <span className="muted small">{dateTime(t.at)}{t.by && `, ${t.by}`}</span>{t.note && <p className="small">{t.note}</p>}</li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
