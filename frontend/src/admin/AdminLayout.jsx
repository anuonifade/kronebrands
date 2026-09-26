import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { adminToken, api } from "../lib/api";
import { ToastHost } from "./ui";

const NAV = [
  { to: "/admin", end: true, label: "Overview", icon: "◧" },
  { to: "/admin/orders", label: "Orders", icon: "☰" },
  { to: "/admin/customers", label: "Customers", icon: "◍" },
  { to: "/admin/products", label: "Products", icon: "◈" },
  { to: "/admin/settings", label: "Settings", icon: "⚙" },
];

// Longest matching prefix wins, so /admin/products/new still says "Products".
const TITLES = [
  ["/admin/orders", "Orders"],
  ["/admin/customers", "Customers"],
  ["/admin/products", "Products"],
  ["/admin/settings", "Settings"],
  ["/admin", "Overview"],
];

export default function AdminLayout() {
  const [me, setMe] = useState(null);
  const [queue, setQueue] = useState(null);
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    if (!adminToken.get()) return nav("/admin/login", { replace: true });
    api.admin.me().then(setMe).catch(() => nav("/admin/login", { replace: true }));
  }, [nav]);

  // The badge on Orders is the thing staff check most, so it refreshes on navigation.
  useEffect(() => {
    if (me) api.admin.stats({ days: 7 }).then((s) => setQueue(s.to_fulfil)).catch(() => {});
  }, [me, pathname]);

  useEffect(() => setOpen(false), [pathname]);

  if (!me) return null;
  const title = TITLES.find(([p]) => pathname.startsWith(p))?.[1] ?? "Admin";

  return (
    <ToastHost>
      <div className={`admin ${open ? "is-open" : ""}`}>
        <aside className="admin__side">
          <p className="wordmark">Kronebrands</p>
          <nav>
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end}>
                <span className="nav__icon" aria-hidden="true">{n.icon}</span>
                {n.label}
                {n.label === "Orders" && queue > 0 && <span className="nav__badge">{queue}</span>}
              </NavLink>
            ))}
          </nav>
          <div className="admin__me">
            <a className="admin__store" href="/" target="_blank" rel="noreferrer">View store ↗</a>
            <p className="small muted">{me.email}</p>
            <button className="linkbtn" onClick={() => { adminToken.clear(); nav("/admin/login"); }}>Sign out</button>
          </div>
        </aside>

        <div className="admin__col">
          <header className="admin__top">
            <button className="admin__burger" aria-label="Menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>☰</button>
            <h1 className="admin__title">{title}</h1>
          </header>
          <main className="admin__main"><Outlet /></main>
        </div>

        <button className="admin__scrim" tabIndex={-1} aria-hidden="true" onClick={() => setOpen(false)} />
      </div>
    </ToastHost>
  );
}
