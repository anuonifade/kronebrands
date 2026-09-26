import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer__grid">
        <div>
          <p className="wordmark wordmark--lg">Kronebrands</p>
          <p className="muted">Hand-crafted shoes from Lagos, Nigeria.</p>
        </div>
        <div>
          <p className="footer__h">Shop</p>
          <Link to="/shop">All shoes</Link>
          <Link to="/shop?line=Royal">Royal</Link>
          <Link to="/shop?category=Brogues">Brogues</Link>
        </div>
        <div>
          <p className="footer__h">Help</p>
          <Link to="/order-status">Order status</Link>
          <Link to="/about#sizing">Sizing</Link>
          <a href="mailto:kronebrands@gmail.com">kronebrands@gmail.com</a>
        </div>
        <div>
          <p className="footer__h">Follow</p>
          <a href="https://www.instagram.com/kronebrands/" target="_blank" rel="noreferrer">Instagram</a>
        </div>
      </div>
      <p className="footer__legal muted small">© {new Date().getFullYear()} Kronebrands. Lagos, Nigeria.</p>
    </footer>
  );
}
