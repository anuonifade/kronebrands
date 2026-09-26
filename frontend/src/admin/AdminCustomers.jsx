import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { dateTime, money, statusLabel } from "../lib/format";
import { Empty, Spinner, useAsync, useDebounced } from "./ui";

const SORTS = [["spent", "Top spenders"], ["orders", "Most orders"], ["recent", "Most recent"], ["name", "Name"]];

export default function AdminCustomers() {
  const [params, setParams] = useSearchParams();
  const sort = params.get("sort") || "spent";
  const page = Number(params.get("page") || 1);
  const [q, setQ] = useState(params.get("q") || "");
  const dq = useDebounced(q);

  const { data, error, loading } = useAsync(
    () => api.admin.customers({ q: dq, sort, page }),
    [dq, sort, page],
  );

  return (
    <>
      <div className="admin__toolbar">
        <div className="seg" role="group" aria-label="Sort customers">
          {SORTS.map(([v, label]) => (
            <button key={v} className={`seg__btn ${sort === v ? "is-on" : ""}`} aria-pressed={sort === v}
                    onClick={() => setParams({ sort: v, q, page: 1 })}>{label}</button>
          ))}
        </div>
        {/* Typing filters as you go; the URL only changes on sort or page, so the
            back button steps through views rather than every keystroke. */}
        <input className="search" placeholder="Search name or email" value={q}
               onChange={(e) => setQ(e.target.value)} />
      </div>

      {error && <p className="error">{error}</p>}
      {loading && !data && <Spinner />}
      {data && data.customers.length === 0 && (
        <Empty title="No customers yet"
               hint="Anyone who places an order appears here, with everything they've bought." />
      )}

      {data && data.customers.length > 0 && (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Customer</th><th>Location</th><th>Orders</th><th>Spent</th><th>Average</th><th>Last order</th></tr>
              </thead>
              <tbody>
                {data.customers.map((c) => (
                  <tr key={c.email}>
                    <td>
                      <Link to={`/admin/customers/${encodeURIComponent(c.email)}`}>{c.name || c.email}</Link>
                      <br /><span className="muted small">{c.email}</span>
                    </td>
                    <td>{[c.city, c.country].filter(Boolean).join(", ") || <span className="muted">—</span>}</td>
                    <td>{c.orders}{c.paid_orders !== c.orders && <span className="muted small"> ({c.paid_orders} paid)</span>}</td>
                    <td>{money(c.spent_cents)}</td>
                    <td>{c.avg_order_cents ? money(c.avg_order_cents) : <span className="muted">—</span>}</td>
                    <td className="nowrap">
                      {dateTime(c.last_order_at)}<br />
                      <span className={`pill pill--${c.last_status}`}>{statusLabel[c.last_status]}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.total > data.page_size && (
            <div className="pager">
              <button className="linkbtn" disabled={page <= 1}
                      onClick={() => setParams({ sort, q, page: page - 1 })}>Previous</button>
              <span className="muted small">Page {page} of {Math.ceil(data.total / data.page_size)}</span>
              <button className="linkbtn" disabled={page * data.page_size >= data.total}
                      onClick={() => setParams({ sort, q, page: page + 1 })}>Next</button>
            </div>
          )}
        </>
      )}
    </>
  );
}
