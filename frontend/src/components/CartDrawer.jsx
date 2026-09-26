import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useCart } from "../lib/cart";
import { money } from "../lib/format";

export default function CartDrawer() {
  const { items, open, setOpen, subtotal, setQty } = useCart();

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  return (
    <>
      <div className={`scrim ${open ? "is-open" : ""}`} onClick={() => setOpen(false)} />
      <aside className={`drawer ${open ? "is-open" : ""}`} aria-hidden={!open} aria-label="Your bag">
        <div className="drawer__head">
          <h2>Your bag</h2>
          <button className="linkbtn" onClick={() => setOpen(false)}>Close</button>
        </div>

        {items.length === 0 ? (
          <div className="drawer__empty">
            <p>Your bag is empty.</p>
            <Link className="btn" to="/shop" onClick={() => setOpen(false)}>Browse the collection</Link>
          </div>
        ) : (
          <>
            <ul className="drawer__lines">
              {items.map((l) => (
                <li key={l.slug + l.size} className="line">
                  <img src={l.image} alt="" />
                  <div>
                    <p className="line__name">{l.name}</p>
                    <p className="muted">{l.colour}, EU {l.size}</p>
                    <div className="qty">
                      <button onClick={() => setQty(l.slug, l.size, l.quantity - 1)} aria-label="Remove one">−</button>
                      <span>{l.quantity}</span>
                      <button onClick={() => setQty(l.slug, l.size, Math.min(10, l.quantity + 1))} aria-label="Add one">+</button>
                    </div>
                  </div>
                  <p>{money(l.price_cents * l.quantity)}</p>
                </li>
              ))}
            </ul>
            <div className="drawer__foot">
              <div className="row"><span>Subtotal</span><span>{money(subtotal)}</span></div>
              <p className="muted small">Shipping is calculated at checkout.</p>
              <Link className="btn btn--block" to="/checkout" onClick={() => setOpen(false)}>Check out</Link>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
