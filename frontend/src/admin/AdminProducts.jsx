import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { money } from "../lib/format";
import { Empty, Spinner, useAsync, useDebounced } from "./ui";

export default function AdminProducts() {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const dq = useDebounced(q);
  const active = filter === "all" ? undefined : filter === "live";
  const { data: products, error, loading } = useAsync(() => api.admin.products({ q: dq, active }), [dq, active]);

  const totalStock = (p) => p.sizes.reduce((n, s) => n + s.stock, 0);

  return (
    <>
      <div className="admin__toolbar">
        <div className="seg" role="group" aria-label="Filter products">
          {[["all", "All"], ["live", "Live"], ["hidden", "Hidden"]].map(([v, label]) => (
            <button key={v} className={`seg__btn ${filter === v ? "is-on" : ""}`} aria-pressed={filter === v}
                    onClick={() => setFilter(v)}>{label}</button>
          ))}
        </div>
        <input className="search" placeholder="Search name, colour or web address" value={q}
               onChange={(e) => setQ(e.target.value)} />
        <Link className="btn" to="/admin/products/new">New product</Link>
      </div>

      {error && <p className="error">{error}</p>}
      {loading && !products && <Spinner />}
      {products && products.length === 0 && (
        <Empty title="No products match" hint="Try a different search, or add one."
               action={<Link className="btn" to="/admin/products/new">New product</Link>} />
      )}

      {products && products.length > 0 && (
        <div className="table-wrap">
          <table className="table table--products">
            <thead>
              <tr><th>Product</th><th>Gallery</th><th>Price</th><th>Stock</th><th>Status</th><th /></tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.slug}>
                  <td>
                    <div className="cellmedia">
                      {p.images[0] ? <img src={p.images[0]} alt="" /> : <span className="cellmedia__blank" />}
                      <div>
                        <Link to={`/admin/products/${p.slug}`}>{p.name}</Link>
                        <p className="muted small">{p.colour.name} · {p.category}</p>
                      </div>
                    </div>
                  </td>
                  <td className="nowrap">{p.images.length} image{p.images.length === 1 ? "" : "s"}{p.video ? " + video" : ""}</td>
                  <td>{money(p.price_cents)}</td>
                  <td>
                    <span className={totalStock(p) === 0 ? "tag tag--out" : totalStock(p) <= 6 ? "tag tag--low" : ""}>
                      {totalStock(p)} pairs
                    </span>
                  </td>
                  <td><span className={`pill ${p.active ? "pill--delivered" : ""}`}>{p.active ? "Live" : "Hidden"}</span></td>
                  <td className="nowrap"><Link className="linkbtn" to={`/admin/products/${p.slug}`}>Edit</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
