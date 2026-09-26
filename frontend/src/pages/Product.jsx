import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Gallery from "../components/Gallery";
import { api } from "../lib/api";
import { useCart } from "../lib/cart";
import { money } from "../lib/format";

export default function Product() {
  const { slug } = useParams();
  const [p, setP] = useState(null);
  const [error, setError] = useState("");
  const [size, setSize] = useState("");
  const [hint, setHint] = useState("");
  const { add } = useCart();

  useEffect(() => {
    setP(null); setSize(""); setHint(""); setError("");
    api.product(slug).then(setP).catch((e) => setError(e.message));
  }, [slug]);

  // Hero first, then the turntable if this colourway has one, then the other angles.
  const shots = useMemo(() => {
    const [hero, ...rest] = p?.images ?? [];
    if (!hero) return [];
    return [
      { type: "image", src: hero },
      ...(p.video ? [{ type: "video", src: p.video, poster: hero }] : []),
      ...rest.map((src) => ({ type: "image", src })),
    ];
  }, [p]);

  if (error) return <div className="page"><p className="error">{error}</p><Link to="/shop">Back to the shop</Link></div>;
  if (!p) return <div className="page"><p className="muted">Loading…</p></div>;

  const chosen = p.sizes.find((s) => s.size === size);
  const onAdd = () => {
    if (!size) return setHint("Choose a size to add this to your bag.");
    add({ slug: p.slug, name: p.name, colour: p.colour.name, size, quantity: 1, price_cents: p.price_cents, image: p.images[0] });
  };

  return (
    <div className="pdp">
      <div className="pdp__media">
        <Gallery items={shots} alt={`${p.name} in ${p.colour.name}`} />
      </div>

      <div className="pdp__info">
        <p className="muted">{p.category}</p>
        <h1 className="display display--md">{p.name}</h1>
        <p className="pdp__price">{money(p.price_cents)}</p>

        <div className="pdp__block">
          <p className="label">Colour: {p.colour.name}</p>
          <div className="pdp__colours">
            <span className="swatch is-current" style={{ "--sw": p.colour.hex }} aria-current="true" title={p.colour.name}><span className="swatch__dot" /></span>
            {p.colourways.map((c) => (
              <Link key={c.slug} to={`/product/${c.slug}`} className="swatch" style={{ "--sw": c.colour.hex }} title={c.colour.name} aria-label={c.colour.name}>
                <span className="swatch__dot" />
              </Link>
            ))}
          </div>
        </div>

        <div className="pdp__block">
          <p className="label">Size (EU)</p>
          <div className="sizes" role="radiogroup" aria-label="Size">
            {p.sizes.map((s) => (
              <button key={s.size} role="radio" aria-checked={size === s.size} disabled={s.stock === 0}
                      className={`size ${size === s.size ? "is-on" : ""}`} onClick={() => { setSize(s.size); setHint(""); }}>
                {s.size}
              </button>
            ))}
          </div>
          {chosen && chosen.stock <= 2 && <p className="small warn">Only {chosen.stock} left in this size.</p>}
          {hint && <p className="small warn" role="alert">{hint}</p>}
        </div>

        <button className="btn btn--block" onClick={onAdd}>Add to bag</button>

        <details open className="pdp__details"><summary>Details</summary><p>{p.description}</p></details>
        <details className="pdp__details"><summary>Sizing</summary><p>Our lasts run true to EU size. If you're between sizes, take the smaller: velvet gives a little with wear.</p></details>
        <details className="pdp__details"><summary>Shipping and exchanges</summary><p>Free shipping over $500. Free size exchanges within 30 days on unworn pairs.</p></details>
      </div>
    </div>
  );
}
