import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useCart } from "../lib/cart";
import { media } from "../lib/media";
import LoopVideo from "./LoopVideo";

const SHOP_COLUMNS = [
  {
    heading: "Shop by style",
    links: [
      ["All shoes", "/shop"],
      ["Velvet loafers", "/shop?category=Velvet loafers"],
      ["Monk straps", "/shop?category=Monk straps"],
      ["Brogues", "/shop?category=Brogues"],
    ],
  },
  {
    heading: "Lines",
    links: [
      ["Royal", "/shop?line=Royal"],
      ["Dignity", "/shop?line=Dignity"],
      ["Prime", "/shop?line=Prime"],
      ["Sovereign", "/shop?line=Sovereign"],
      ["Grandeur", "/shop?line=Grandeur"],
    ],
  },
];

export default function Header() {
  const { count, setOpen } = useCart();
  const [mega, setMega] = useState(false);
  const [mobile, setMobile] = useState(false);
  const closeTimer = useRef();
  const { pathname, search } = useLocation();

  useEffect(() => { setMega(false); setMobile(false); }, [pathname, search]);

  const openMega = () => { clearTimeout(closeTimer.current); setMega(true); };
  const closeMega = () => { closeTimer.current = setTimeout(() => setMega(false), 120); };

  return (
    <header className="header">
      <div className="header__bar">
        <button className="header__burger" aria-label="Open menu" aria-expanded={mobile} onClick={() => setMobile((m) => !m)}>
          <span /><span />
        </button>

        <nav className="header__nav" aria-label="Primary">
          <div className="header__shop" onMouseEnter={openMega} onMouseLeave={closeMega}>
            <button className="navlink" aria-expanded={mega} aria-controls="mega" onClick={() => setMega((m) => !m)}>
              Shop
            </button>
          </div>
          <NavLink className="navlink" to="/shop?line=Royal">Royal</NavLink>
          <NavLink className="navlink" to="/about">Atelier</NavLink>
        </nav>

        <Link to="/" className="wordmark" aria-label="Kronebrands home">Kronebrands</Link>

        <div className="header__actions">
          <NavLink className="navlink hide-sm" to="/order-status">Order status</NavLink>
          <button className="navlink bag" onClick={() => setOpen(true)} aria-label={`Bag, ${count} items`}>
            Bag <span className="bag__count">{count}</span>
          </button>
        </div>
      </div>

      <div
        id="mega"
        className={`mega ${mega ? "is-open" : ""}`}
        onMouseEnter={openMega}
        onMouseLeave={closeMega}
        hidden={!mega}
      >
        <div className="mega__inner">
          {SHOP_COLUMNS.map((col) => (
            <div key={col.heading} className="mega__col">
              <p className="mega__heading">{col.heading}</p>
              {col.links.map(([label, to]) => <Link key={label} to={to}>{label}</Link>)}
            </div>
          ))}
          <Link to="/shop?line=Royal" className="mega__tile">
            <LoopVideo src={media.magentaTurntable} poster={media.heroPoster} />
            <span>Royal, in five velvets</span>
          </Link>
          <Link to="/about" className="mega__tile">
            <LoopVideo src={media.craftVideo} poster={media.craft} />
            <span>Inside the atelier</span>
          </Link>
        </div>
      </div>

      {mobile && (
        <nav className="mobile-nav" aria-label="Mobile">
          {SHOP_COLUMNS.flatMap((c) => c.links).map(([label, to]) => <Link key={label} to={to}>{label}</Link>)}
          <Link to="/about">Atelier</Link>
          <Link to="/order-status">Order status</Link>
        </nav>
      )}
    </header>
  );
}
