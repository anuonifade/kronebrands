import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { money } from "../lib/format";
import { Field, MoneyInput, Panel, Spinner, useToast } from "./ui";

const slugify = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const newZone = (n) => ({ id: `zone-${n}`, name: "", countries: [], rate_cents: 2500, free_over_cents: null });

export default function AdminSettings() {
  const [shipping, setShipping] = useState(null);
  const [saved, setSaved] = useState(null);
  const [storage, setStorage] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  useEffect(() => {
    api.admin.settings()
      .then((d) => { setShipping(d.shipping); setSaved(d.shipping); setStorage(d.storage); })
      .catch((e) => setError(e.message));
  }, []);

  if (error && !shipping) return <p className="error">{error}</p>;
  if (!shipping) return <Spinner />;

  const dirty = JSON.stringify(shipping) !== JSON.stringify(saved);
  const setZone = (i, patch) =>
    setShipping((s) => ({ ...s, zones: s.zones.map((z, j) => (j === i ? { ...z, ...patch } : z)) }));

  const save = async (e) => {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      const body = {
        zones: shipping.zones.map((z) => ({
          ...z,
          id: z.id || slugify(z.name),
          countries: z.countries.filter(Boolean),
        })),
        default_rate_cents: shipping.default_rate_cents,
        default_free_over_cents: shipping.default_free_over_cents,
      };
      const { shipping: next } = await api.admin.saveShipping(body);
      setShipping(next); setSaved(next);
      toast("Shipping rates saved. New orders use them straight away.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save}>
      <div className="admin__toolbar admin__toolbar--edit">
        <p className="muted small">Rates apply to orders placed from now on. Orders already taken keep what they were charged.</p>
        <div className="admin__toolbar-right">
          {dirty && <span className="muted small">Unsaved changes</span>}
          <button className="btn" disabled={busy || !dirty}>Save shipping</button>
        </div>
      </div>

      {error && <p className="error" role="alert">{error}</p>}

      <div className="grid grid--2-1">
        <div>
          <Panel
            title="Shipping zones"
            action={
              <button type="button" className="btn btn--ghost"
                      onClick={() => setShipping((s) => ({ ...s, zones: [...s.zones, newZone(s.zones.length + 1)] }))}>
                Add zone
              </button>
            }
          >
            <p className="muted small panel__intro">
              The first zone listing the destination country sets the price, so put your most
              specific zones first. Anything not covered falls back to the default rate.
            </p>

            {shipping.zones.length === 0 && <p className="muted small">No zones — every order pays the default rate.</p>}

            {shipping.zones.map((z, i) => (
              <div key={i} className="zone">
                <div className="zone__grid">
                  <Field label="Zone name">
                    <input required value={z.name} placeholder="e.g. Lagos"
                           onChange={(e) => setZone(i, { name: e.target.value, id: z.id || slugify(e.target.value) })} />
                  </Field>
                  <Field label="Rate">
                    <MoneyInput cents={z.rate_cents} onChange={(c) => setZone(i, { rate_cents: c ?? 0 })} />
                  </Field>
                  <Field label="Free over" hint="Leave empty for no free shipping in this zone.">
                    <MoneyInput cents={z.free_over_cents} placeholder="—"
                                onChange={(c) => setZone(i, { free_over_cents: c })} />
                  </Field>
                  <Field label="Countries" wide hint="Two-letter codes, comma separated — NG, GH, BJ.">
                    <input value={z.countries.join(", ")}
                           onChange={(e) => setZone(i, { countries: e.target.value.split(",").map((c) => c.trim().toUpperCase()) })} />
                  </Field>
                </div>
                <div className="zone__foot">
                  <span className="muted small">
                    {z.countries.filter(Boolean).length || "No"} countr{z.countries.filter(Boolean).length === 1 ? "y" : "ies"}
                    {" · "}{money(z.rate_cents)}
                    {z.free_over_cents != null && `, free over ${money(z.free_over_cents)}`}
                  </span>
                  <button type="button" className="linkbtn danger"
                          onClick={() => setShipping((s) => ({ ...s, zones: s.zones.filter((_, j) => j !== i) }))}>
                    Remove zone
                  </button>
                </div>
              </div>
            ))}
          </Panel>

          <Panel title="Everywhere else">
            <div className="formgrid formgrid--2">
              <Field label="Default rate" hint="Charged when no zone covers the country.">
                <MoneyInput cents={shipping.default_rate_cents}
                            onChange={(c) => setShipping((s) => ({ ...s, default_rate_cents: c ?? 0 }))} />
              </Field>
              <Field label="Free over" hint="Leave empty to always charge the default rate.">
                <MoneyInput cents={shipping.default_free_over_cents} placeholder="—"
                            onChange={(c) => setShipping((s) => ({ ...s, default_free_over_cents: c }))} />
              </Field>
            </div>
          </Panel>
        </div>

        <div>
          <RateTester dirty={dirty} />

          <Panel title="Image uploads">
            {storage?.uploads_enabled ? (
              <p className="small">
                Uploading to <strong>{storage.provider}</strong>, up to{" "}
                {Math.round(storage.max_bytes / 1048576)}MB per image.
              </p>
            ) : (
              <>
                <p className="muted small">{storage?.reason}</p>
                <p className="muted small">
                  Set <code>MEDIA_STORAGE</code> to <code>s3</code> or <code>cloudinary</code> in the backend
                  environment, with that provider's credentials. Until then, images are added by URL.
                </p>
              </>
            )}
          </Panel>
        </div>
      </div>
    </form>
  );
}

/** Checks a basket against the saved rates — the same call checkout makes. */
function RateTester({ dirty }) {
  const [country, setCountry] = useState("NG");
  const [subtotal, setSubtotal] = useState(25000);
  const [quote, setQuote] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let live = true;
    api.admin.previewShipping({ country, subtotal_cents: subtotal })
      .then((q) => live && (setQuote(q), setErr("")))
      .catch((e) => live && setErr(e.message));
    return () => { live = false; };
  }, [country, subtotal]);

  return (
    <Panel title="Test a basket">
      <div className="formgrid formgrid--2">
        <Field label="Ship to"><input value={country} maxLength="2"
               onChange={(e) => setCountry(e.target.value.toUpperCase())} /></Field>
        <Field label="Basket"><MoneyInput cents={subtotal} onChange={(c) => setSubtotal(c ?? 0)} /></Field>
      </div>
      {err && <p className="error small">{err}</p>}
      {quote && (
        <p className="quote">
          <span className="quote__n">{quote.is_free ? "Free" : money(quote.cents)}</span>
          <span className="muted small">
            {quote.zone}
            {quote.is_free && quote.free_over_cents != null && ` · over ${money(quote.free_over_cents)}`}
          </span>
        </p>
      )}
      {dirty && <p className="muted small">Showing the saved rates — save to test your edits.</p>}
    </Panel>
  );
}
