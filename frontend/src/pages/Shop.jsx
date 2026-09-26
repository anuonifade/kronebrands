import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import ProductCard from "../components/ProductCard";
import { api } from "../lib/api";

const CATEGORIES = ["Velvet loafers", "Monk straps", "Brogues"];

export default function Shop() {
  const [params, setParams] = useSearchParams();
  const [products, setProducts] = useState(null);
  const [error, setError] = useState("");
  const category = params.get("category") || "";
  const line = params.get("line") || "";
  const sort = params.get("sort") || "featured";

  useEffect(() => {
    setProducts(null);
    api.products({ category, line, sort }).then(setProducts).catch((e) => setError(e.message));
  }, [category, line, sort]);

  const set = (k, v) => {
    const next = new URLSearchParams(params);
    v ? next.set(k, v) : next.delete(k);
    if (k === "category") next.delete("line");
    setParams(next);
  };

  const title = line || category || "All shoes";

  return (
    <div className="page">
      <div className="shop__head">
        <h1 className="display display--md">{title}</h1>
        <div className="shop__controls">
          <div className="chips" role="group" aria-label="Filter by style">
            <button className={`chip ${!category && !line ? "is-on" : ""}`} onClick={() => setParams({})}>All</button>
            {CATEGORIES.map((c) => (
              <button key={c} className={`chip ${category === c ? "is-on" : ""}`} onClick={() => set("category", c)}>{c}</button>
            ))}
          </div>
          <label className="select">
            <span className="sr-only">Sort</span>
            <select value={sort} onChange={(e) => set("sort", e.target.value)}>
              <option value="featured">Featured</option>
              <option value="price_asc">Price, low to high</option>
              <option value="price_desc">Price, high to low</option>
              <option value="newest">Newest</option>
            </select>
          </label>
        </div>
      </div>

      {error && <p className="error">Couldn't load products: {error}</p>}
      {!products && !error && <p className="muted">Loading…</p>}
      {products && products.length === 0 && <p>Nothing matches that filter yet. <button className="linkbtn" onClick={() => setParams({})}>See all shoes</button></p>}
      <div className="grid">{products?.map((p) => <ProductCard key={p.slug} p={p} />)}</div>
    </div>
  );
}
