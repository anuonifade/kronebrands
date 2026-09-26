import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { dateTime, money, statusLabel } from "../lib/format";
import { Stat } from "./charts";
import { Panel, Spinner, useAsync } from "./ui";

export default function AdminCustomerDetail() {
  const { email } = useParams();
  const { data: c, error, loading } = useAsync(() => api.admin.customer(email), [email]);

  if (loading && !c) return <Spinner />;
  if (error) return <p className="error">{error}</p>;

  return (
    <>
      <div className="admin__toolbar admin__toolbar--edit">
        <Link className="linkbtn" to="/admin/customers">← Customers</Link>
        <a className="linkbtn" href={`mailto:${c.email}`}>Email {c.name?.split(" ")[0] || "them"}</a>
      </div>

      <div className="stats">
        <Stat label="Spent" value={money(c.spent_cents)} sub={`${c.paid_orders} paid order${c.paid_orders === 1 ? "" : "s"}`} />
        <Stat label="Average order" value={c.avg_order_cents ? money(c.avg_order_cents) : "—"} />
        <Stat label="Orders placed" value={c.orders} sub={c.orders !== c.paid_orders ? `${c.orders - c.paid_orders} unpaid or cancelled` : "All paid"} />
        <Stat label="Customer since" value={dateTime(c.first_order_at).split(",")[0]} sub={`Last order ${dateTime(c.last_order_at)}`} />
      </div>

      <div className="grid grid--2-1">
        <Panel title="Order history">
          <div className="table-wrap table-wrap--flush">
            <table className="table">
              <thead><tr><th>Order</th><th>Placed</th><th>Items</th><th>Total</th><th>Status</th></tr></thead>
              <tbody>
                {c.order_history.map((o) => (
                  <tr key={o.order_number}>
                    <td><Link to={`/admin/orders/${o.order_number}`}>{o.order_number}</Link></td>
                    <td className="nowrap">{dateTime(o.created_at)}</td>
                    <td>{o.items.reduce((n, l) => n + l.quantity, 0)}</td>
                    <td>{money(o.total_cents)}</td>
                    <td><span className={`pill pill--${o.status}`}>{statusLabel[o.status]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <div>
          <Panel title="Contact">
            <p className="big">{c.name}</p>
            <p><a href={`mailto:${c.email}`}>{c.email}</a>{c.phone && <><br />{c.phone}</>}</p>
          </Panel>

          <Panel title={c.addresses.length > 1 ? "Addresses used" : "Address"}>
            {c.addresses.map((a, i) => (
              <p key={i} className={i ? "muted" : ""}>
                {a.line1}{a.line2 && <><br />{a.line2}</>}<br />
                {a.city}{a.state && `, ${a.state}`} {a.postal_code}<br />{a.country}
              </p>
            ))}
          </Panel>

          <Panel title="What they've bought">
            <ul className="bought">
              {Object.values(
                c.order_history.flatMap((o) => o.items).reduce((acc, l) => {
                  const k = l.slug + l.size;
                  acc[k] = acc[k] || { ...l, quantity: 0 };
                  acc[k].quantity += l.quantity;
                  return acc;
                }, {}),
              ).map((l) => (
                <li key={l.slug + l.size}>
                  {l.image && <img src={l.image} alt="" />}
                  <div>
                    <p className="line__name">{l.name} × {l.quantity}</p>
                    <p className="muted small">{l.colour} · EU {l.size}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}
