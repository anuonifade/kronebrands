import { Link } from "react-router-dom";
import { money } from "../lib/format";

export default function ProductCard({ p }) {
  const soldOut = p.sizes.every((s) => s.stock === 0);
  return (
    <Link to={`/product/${p.slug}`} className="card">
      <div className="card__media">
        <img src={p.images[0]} alt={`${p.name} in ${p.colour.name}`} loading="lazy" />
        {(p.badge || soldOut) && <span className="card__badge">{soldOut ? "Sold out" : p.badge}</span>}
      </div>
      <div className="card__meta">
        <p className="card__name">{p.name}</p>
        <p className="card__price">{money(p.price_cents)}</p>
        <p className="card__colour">
          <i style={{ background: p.colour.hex }} aria-hidden /> {p.colour.name}
        </p>
      </div>
    </Link>
  );
}
