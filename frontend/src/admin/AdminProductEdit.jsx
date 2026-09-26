import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { money } from "../lib/format";
import ImageManager from "./ImageManager";
import { Confirm, Field, MoneyInput, Panel, Spinner, useToast } from "./ui";

const EU_SIZES = ["39", "40", "41", "42", "43", "44", "45", "46"];

const blank = () => ({
  slug: "", name: "", line: "", category: "", description: "", price_cents: 25000,
  colour: { name: "", hex: "#1B1A18" }, images: [], video: "", badge: "",
  sizes: EU_SIZES.map((size) => ({ size, stock: 0 })), featured: false, active: true,
});

const slugify = (s) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export default function AdminProductEdit() {
  const { slug } = useParams();
  const isNew = !slug;
  const nav = useNavigate();
  const toast = useToast();

  const [p, setP] = useState(isNew ? blank() : null);
  const [saved, setSaved] = useState(isNew ? blank() : null);
  const [lines, setLines] = useState({ lines: [], categories: [] });
  const [uploads, setUploads] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [slugTouched, setSlugTouched] = useState(!isNew);

  useEffect(() => {
    api.admin.lines().then(setLines).catch(() => {});
    api.admin.mediaStatus().then(setUploads).catch(() => setUploads({ uploads_enabled: false }));
  }, []);

  useEffect(() => {
    if (isNew) return;
    setError("");
    api.admin.product(slug)
      .then((d) => { const v = { ...d, video: d.video || "", badge: d.badge || "" }; setP(v); setSaved(v); })
      .catch((e) => setError(e.message));
  }, [slug, isNew]);

  if (error && !p) return <p className="error">{error}</p>;
  if (!p) return <Spinner />;

  const set = (patch) => setP((x) => ({ ...x, ...patch }));
  const dirty = JSON.stringify(p) !== JSON.stringify(saved);

  /* ---------- images ----------
     A saved product writes straight through to the API, so the gallery is always
     what the shop is serving. A product still being drafted just edits state and
     is sent with the create. */
  const persistImages = async (call) => {
    setBusy(true);
    try {
      const { images } = await call();
      setP((x) => ({ ...x, images }));
      setSaved((x) => ({ ...x, images }));
    } catch (e) {
      toast(e.message, "warn");
    } finally {
      setBusy(false);
    }
  };

  // Functional updates, so uploading several files in a row doesn't keep only the last.
  const onAddImage = (url) =>
    isNew
      ? setP((x) => ({ ...x, images: x.images.includes(url) ? x.images : [...x.images, url] }))
      : persistImages(() => api.admin.addImage(slug, url));

  const onRemoveImage = (i) =>
    isNew
      ? setP((x) => ({ ...x, images: x.images.filter((_, j) => j !== i) }))
      : persistImages(() => api.admin.removeImage(slug, i));

  const onReorderImages = (next) =>
    isNew ? set({ images: next }) : persistImages(() => api.admin.setImages(slug, next));

  /* ---------- save ---------- */
  const save = async (e) => {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      if (isNew) {
        const body = {
          ...p,
          slug: p.slug || slugify(`${p.name} ${p.colour.name}`),
          badge: p.badge || null,
          video: p.video || null,
        };
        const created = await api.admin.createProduct(body);
        toast(`${created.name} created.`);
        nav(`/admin/products/${created.slug}`, { replace: true });
      } else {
        const body = {
          name: p.name, line: p.line, category: p.category, description: p.description,
          price_cents: p.price_cents, colour: p.colour, sizes: p.sizes,
          active: p.active, featured: p.featured, badge: p.badge, video: p.video,
        };
        const updated = await api.admin.updateProduct(slug, body);
        const v = { ...updated, video: updated.video || "", badge: updated.badge || "" };
        setP(v); setSaved(v);
        toast("Saved.");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const destroy = async () => {
    setBusy(true);
    try {
      await api.admin.deleteProduct(slug);
      toast(`${p.name} deleted.`);
      nav("/admin/products", { replace: true });
    } catch (e) { setError(e.message); setBusy(false); }
  };

  const stock = p.sizes.reduce((n, s) => n + s.stock, 0);

  return (
    <form onSubmit={save}>
      <div className="admin__toolbar admin__toolbar--edit">
        <Link className="linkbtn" to="/admin/products">← Products</Link>
        <div className="admin__toolbar-right">
          {dirty && <span className="muted small">Unsaved changes</span>}
          {!isNew && p.active && (
            <a className="linkbtn" href={`/product/${slug}`} target="_blank" rel="noreferrer">View in store ↗</a>
          )}
          <button className="btn" disabled={busy || (!isNew && !dirty)}>
            {isNew ? "Create product" : "Save changes"}
          </button>
        </div>
      </div>

      {error && <p className="error" role="alert">{error}</p>}

      <div className="cols cols--2-1">
        <div>
          <Panel title={isNew ? "New product" : p.name}>
            <div className="formgrid">
              <Field label="Name">
                <input required value={p.name}
                       onChange={(e) => {
                         const name = e.target.value;
                         set({ name, ...(isNew && !slugTouched ? { slug: slugify(`${name} ${p.colour.name}`) } : {}) });
                       }} />
              </Field>
              <Field label="Colour">
                <input required value={p.colour.name}
                       onChange={(e) => {
                         const cname = e.target.value;
                         set({ colour: { ...p.colour, name: cname },
                               ...(isNew && !slugTouched ? { slug: slugify(`${p.name} ${cname}`) } : {}) });
                       }} />
              </Field>
              <Field label="Swatch">
                <div className="swatch-in">
                  <input type="color" value={p.colour.hex}
                         onChange={(e) => set({ colour: { ...p.colour, hex: e.target.value } })} />
                  <input value={p.colour.hex} aria-label="Swatch hex"
                         onChange={(e) => set({ colour: { ...p.colour, hex: e.target.value } })} />
                </div>
              </Field>
              <Field label="Price">
                <MoneyInput cents={p.price_cents} min={1} onChange={(c) => set({ price_cents: c ?? 0 })} />
              </Field>
              <Field label="Line" hint="Colourways of the same line are shown together on the product page.">
                <input required list="lines" value={p.line} onChange={(e) => set({ line: e.target.value })} />
                <datalist id="lines">{lines.lines.map((l) => <option key={l} value={l} />)}</datalist>
              </Field>
              <Field label="Category">
                <input required list="cats" value={p.category} onChange={(e) => set({ category: e.target.value })} />
                <datalist id="cats">{lines.categories.map((c) => <option key={c} value={c} />)}</datalist>
              </Field>
              <Field label="Web address" wide
                     hint={isNew ? "Made from the name and colour; edit it if you'd rather." : "Changing this would break existing links, so it's fixed once created."}>
                <div className="slug-in">
                  <span className="muted">/product/</span>
                  <input required value={p.slug} readOnly={!isNew} pattern="[a-z0-9]+(-[a-z0-9]+)*"
                         onChange={(e) => { setSlugTouched(true); set({ slug: slugify(e.target.value) }); }} />
                </div>
              </Field>
              <Field label="Description" wide>
                <textarea rows="4" value={p.description} onChange={(e) => set({ description: e.target.value })} />
              </Field>
              <Field label="Badge" hint="Small label on the shop card, e.g. “Best seller”. Leave empty for none.">
                <input value={p.badge} onChange={(e) => set({ badge: e.target.value })} />
              </Field>
              <Field label="Video URL" hint="Optional turntable clip, shown after the hero image.">
                <input type="url" value={p.video} onChange={(e) => set({ video: e.target.value })} />
              </Field>
            </div>
          </Panel>

          <Panel>
            <ImageManager
              images={p.images} uploads={uploads} busy={busy}
              onAdd={onAddImage} onRemove={onRemoveImage} onReorder={onReorderImages}
            />
          </Panel>
        </div>

        <div>
          <Panel title="Visibility">
            <label className="check">
              <input type="checkbox" checked={p.active} onChange={(e) => set({ active: e.target.checked })} />
              <span>Live in the store<em className="field__hint">Hidden products can't be viewed or bought.</em></span>
            </label>
            <label className="check">
              <input type="checkbox" checked={p.featured} onChange={(e) => set({ featured: e.target.checked })} />
              <span>Featured<em className="field__hint">Sorts to the front of the shop.</em></span>
            </label>
          </Panel>

          <Panel title="Stock by size" action={<span className="muted small">{stock} pairs</span>}>
            <div className="sizegrid">
              {p.sizes.map((s, i) => (
                <label key={s.size} className={`stock ${s.stock === 0 ? "is-out" : s.stock <= 2 ? "is-low" : ""}`}>
                  <span>EU {s.size}</span>
                  <input type="number" min="0" value={s.stock}
                         onChange={(e) => set({
                           sizes: p.sizes.map((x, j) => (j === i ? { ...x, stock: Math.max(0, Number(e.target.value) || 0) } : x)),
                         })} />
                </label>
              ))}
            </div>
            <p className="muted small panel__foot">
              Stock is held the moment an order is placed and returned if it's cancelled.
            </p>
          </Panel>

          {!isNew && (
            <Panel title="Danger zone">
              <p className="muted small">
                Deleting removes {p.name} from the catalogue. Past orders keep their own copy of the line,
                so order history is unaffected. To take it off sale without deleting, untick “Live in the store”.
              </p>
              <Confirm label="Delete product" question={`Delete ${p.name} for good?`} onConfirm={destroy} busy={busy} />
            </Panel>
          )}

          {!isNew && (
            <Panel title="At a glance">
              <dl className="facts">
                <div><dt>Price</dt><dd>{money(p.price_cents)}</dd></div>
                <div><dt>Images</dt><dd>{p.images.length}</dd></div>
                <div><dt>Sizes in stock</dt><dd>{p.sizes.filter((s) => s.stock > 0).length} of {p.sizes.length}</dd></div>
              </dl>
            </Panel>
          )}
        </div>
      </div>
    </form>
  );
}
