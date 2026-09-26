import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { dateTime, money, statusLabel } from "../lib/format";
import { BarList, RevenueChart, Stat } from "./charts";
import { Empty, Panel, Spinner, useAsync } from "./ui";

const RANGES = [[7, "7 days"], [30, "30 days"], [90, "90 days"]];

// The order a pair travels through, so the pipeline reads top to bottom.
const PIPELINE = ["pending_payment", "paid", "processing", "shipped", "delivered", "cancelled"];

export default function AdminDashboard() {
  const [days, setDays] = useState(30);
  const { data: s, error, loading } = useAsync(() => api.admin.stats({ days }), [days]);

  if (loading && !s) return <Spinner />;
  if (error) return <p className="error">{error}</p>;

  const perDay = s.period.revenue_cents / s.window_days;

  return (
    <>
      <div className="admin__toolbar">
        <div className="seg" role="group" aria-label="Date range">
          {RANGES.map(([n, label]) => (
            <button key={n} className={`seg__btn ${days === n ? "is-on" : ""}`} aria-pressed={days === n}
                    onClick={() => setDays(n)}>{label}</button>
          ))}
        </div>
      </div>

      <div className="stats">
        <Stat label={`Revenue · last ${s.window_days} days`} value={money(s.period.revenue_cents)}
              sub={`${money(perDay)} a day on average`} />
        <Stat label="Orders" value={s.period.orders}
              sub={s.period.orders ? `${money(s.period.avg_order_cents)} average order` : "No paid orders yet"} />
        <Stat label="To fulfil" value={s.to_fulfil} tone={s.to_fulfil ? "urgent" : ""}
              sub={s.counts.shipped ? `${s.counts.shipped} in transit` : "Nothing waiting on you"} />
        <Stat label="Customers who bought" value={s.period.customers}
              sub={`${s.products_active} of ${s.products_total} products live`} />
      </div>

      <div className="cols cols--2-1">
        <Panel title={`Revenue, last ${s.window_days} days`}>
          {s.period.revenue_cents > 0
            ? <RevenueChart series={s.series} />
            : <Empty title="No paid orders in this window" hint="Revenue appears here once an order is paid." />}
        </Panel>

        <Panel title="Fulfilment pipeline">
          <BarList
            rows={PIPELINE.map((k) => ({ key: k, label: statusLabel[k], value: s.counts[k] || 0 }))}
            empty="No orders yet."
          />
          <p className="muted small panel__foot">
            <Link to="/admin/orders?status=paid">Open the fulfilment queue →</Link>
          </p>
        </Panel>
      </div>

      <div className="cols cols--2-1">
        <Panel title="Recent orders" action={<Link className="linkbtn" to="/admin/orders">All orders</Link>}>
          {s.recent_orders.length === 0 ? (
            <Empty title="No orders yet" hint="They'll show up here the moment one is placed." />
          ) : (
            <div className="table-wrap table-wrap--flush">
              <table className="table">
                <thead><tr><th>Order</th><th>Customer</th><th>Placed</th><th>Total</th><th>Status</th></tr></thead>
                <tbody>
                  {s.recent_orders.map((o) => (
                    <tr key={o.order_number}>
                      <td><Link to={`/admin/orders/${o.order_number}`}>{o.order_number}</Link></td>
                      <td>{o.full_name}<br /><span className="muted small">{o.email}</span></td>
                      <td className="nowrap">{dateTime(o.created_at)}</td>
                      <td>{money(o.total_cents)}</td>
                      <td><span className={`pill pill--${o.status}`}>{statusLabel[o.status]}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title="Needs restocking" action={<Link className="linkbtn" to="/admin/products">Products</Link>}>
          {s.low_stock.length === 0 ? (
            <Empty title="Every size is in stock" />
          ) : (
            <ul className="stocklist">
              {s.low_stock.slice(0, 8).map((r) => (
                <li key={r.slug + r.size}>
                  {r.image && <img src={r.image} alt="" />}
                  <div>
                    <Link to={`/admin/products/${r.slug}`}>{r.name}</Link>
                    <p className="muted small">{r.colour} · EU {r.size}</p>
                  </div>
                  <span className={`tag ${r.stock === 0 ? "tag--out" : "tag--low"}`}>
                    {r.stock === 0 ? "Sold out" : `${r.stock} left`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title={`Best sellers, last ${s.window_days} days`}>
        {s.top_products.length === 0 ? (
          <Empty title="No sales in this window yet" />
        ) : (
          <div className="toplist">
            {s.top_products.map((p) => (
              <Link key={p.slug} to={`/admin/products/${p.slug}`} className="toplist__item">
                {p.image ? <img src={p.image} alt="" /> : <span className="toplist__blank" />}
                <p className="toplist__name">{p.name}</p>
                <p className="muted small">{p.colour}</p>
                <p className="toplist__n">{p.units} sold · {money(p.revenue_cents)}</p>
              </Link>
            ))}
          </div>
        )}
      </Panel>
    </>
  );
}
