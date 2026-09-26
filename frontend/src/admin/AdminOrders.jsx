import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { dateTime, money, statusLabel } from "../lib/format";

const TABS = [
  ["", "All"], ["paid", "To fulfil"], ["processing", "Preparing"], ["shipped", "Shipped"],
  ["delivered", "Delivered"], ["pending_payment", "Awaiting payment"], ["cancelled", "Cancelled"],
];

export default function AdminOrders() {
  const [params, setParams] = useSearchParams();
  const status = params.get("status") ?? "paid";
  const page = Number(params.get("page") || 1);
  const [q, setQ] = useState(params.get("q") || "");
  const [data, setData] = useState(null);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");

  // Only the per-status counts are wanted here, so ask for the smallest window.
  useEffect(() => { api.admin.stats({ days: 7 }).then(setStats).catch(() => {}); }, []);
  useEffect(() => {
    setData(null);
    api.admin.orders({ status, q: params.get("q") || "", page }).then(setData).catch((e) => setError(e.message));
  }, [status, page, params]);

  const go = (next) => setParams({ status, q, page: 1, ...next });

  return (
    <>
      <div className="admin__bar">
        <div className="tabs" role="tablist">
          {TABS.map(([v, label]) => (
            <button key={v || "all"} role="tab" aria-selected={status === v} className={`tab ${status === v ? "is-on" : ""}`} onClick={() => go({ status: v })}>
              {label}{v && stats ? ` (${stats.counts[v]})` : ""}
            </button>
          ))}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); go({ q }); }}>
          <input className="search" placeholder="Search order no., name or email" value={q} onChange={(e) => setQ(e.target.value)} />
        </form>
      </div>

      {error && <p className="error">{error}</p>}
      {!data && !error && <p className="muted">Loading…</p>}
      {data && data.orders.length === 0 && <p className="muted">No orders here. {status === "paid" && "Everything paid has been fulfilled."}</p>}
      {data && data.orders.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Order</th><th>Placed</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th></tr></thead>
            <tbody>
              {data.orders.map((o) => (
                <tr key={o.order_number}>
                  <td><Link to={`/admin/orders/${o.order_number}`}>{o.order_number}</Link></td>
                  <td>{dateTime(o.created_at)}</td>
                  <td>{o.full_name}<br /><span className="muted small">{o.email}</span></td>
                  <td>{o.items.reduce((n, l) => n + l.quantity, 0)}</td>
                  <td>{money(o.total_cents)}</td>
                  <td><span className={`pill pill--${o.status}`}>{statusLabel[o.status]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && data.total > data.page_size && (
        <div className="pager">
          <button className="linkbtn" disabled={page <= 1} onClick={() => go({ page: page - 1 })}>Previous</button>
          <span className="muted small">Page {page} of {Math.ceil(data.total / data.page_size)}</span>
          <button className="linkbtn" disabled={page * data.page_size >= data.total} onClick={() => go({ page: page + 1 })}>Next</button>
        </div>
      )}
    </>
  );
}
