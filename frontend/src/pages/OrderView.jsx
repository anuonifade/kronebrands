import { money, statusLabel, dateTime } from "../lib/format";

const STEPS = ["paid", "processing", "shipped", "delivered"];

export default function OrderView({ order }) {
  const idx = STEPS.indexOf(order.status);
  return (
    <div className="order">
      <p className="muted">Order {order.order_number}</p>
      <h1 className="display display--md">{statusLabel[order.status]}</h1>

      {order.status !== "cancelled" && order.status !== "pending_payment" && (
        <ol className="progress" aria-label="Order progress">
          {STEPS.map((s, i) => (
            <li key={s} className={i <= idx ? "is-done" : ""}>{statusLabel[s].replace(", to fulfil", "")}</li>
          ))}
        </ol>
      )}

      {order.fulfillment?.tracking_number && (
        <p className="notice">
          Shipped with {order.fulfillment.carrier || "our courier"}. Tracking number <strong>{order.fulfillment.tracking_number}</strong>
        </p>
      )}

      <ul className="order__lines">
        {order.items.map((l) => (
          <li key={l.slug + l.size} className="line">
            <img src={l.image} alt="" />
            <div><p className="line__name">{l.name} × {l.quantity}</p><p className="muted small">{l.colour}, EU {l.size}</p></div>
            <p>{money(l.unit_price_cents * l.quantity)}</p>
          </li>
        ))}
      </ul>
      <div className="row"><span>Shipping</span><span>{order.shipping_cents ? money(order.shipping_cents) : "Free"}</span></div>
      <div className="row row--total"><span>Total</span><span>{money(order.total_cents)}</span></div>

      <div className="order__meta">
        <div>
          <p className="label">Shipping to</p>
          <p>{order.full_name}<br />{order.shipping_address.line1}{order.shipping_address.line2 && <>, {order.shipping_address.line2}</>}<br />
            {order.shipping_address.city} {order.shipping_address.postal_code}, {order.shipping_address.country}</p>
        </div>
        <div>
          <p className="label">History</p>
          <ul className="timeline">
            {order.timeline.map((t, i) => <li key={i}><span>{statusLabel[t.status]}</span> <span className="muted small">{dateTime(t.at)}</span></li>)}
          </ul>
        </div>
      </div>
    </div>
  );
}
