import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

/* ---------- Toasts ---------- */
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastHost({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((message, tone = "ok") => {
    const id = Math.random().toString(36).slice(2);
    setItems((xs) => [...xs, { id, message, tone }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 4500);
  }, []);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast toast--${t.tone}`}>
            {t.message}
            <button className="toast__x" aria-label="Dismiss" onClick={() => setItems((xs) => xs.filter((x) => x.id !== t.id))}>×</button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------- Layout pieces ---------- */
export function Panel({ title, action, children, className = "" }) {
  return (
    <section className={`panel ${className}`}>
      {(title || action) && (
        <header className="panel__bar">
          {title && <h2 className="panel__h">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Empty({ title, hint, action }) {
  return (
    <div className="empty">
      <p className="empty__t">{title}</p>
      {hint && <p className="muted small">{hint}</p>}
      {action}
    </div>
  );
}

export function Spinner({ label = "Loading…" }) {
  return <p className="muted" role="status">{label}</p>;
}

/** Destructive action that asks once, inline, instead of a browser confirm(). */
export function Confirm({ label, question, onConfirm, busy }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 6000);
    return () => clearTimeout(t);
  }, [armed]);

  if (!armed) return <button type="button" className="btn btn--danger" onClick={() => setArmed(true)}>{label}</button>;
  return (
    <span className="confirm">
      <span className="small">{question}</span>
      <button type="button" className="btn btn--danger" disabled={busy} onClick={onConfirm}>Yes, {label.toLowerCase()}</button>
      <button type="button" className="linkbtn" onClick={() => setArmed(false)}>Keep it</button>
    </span>
  );
}

/* ---------- Form fields ---------- */
export function Field({ label, hint, children, wide }) {
  return (
    <label className={`field ${wide ? "field--wide" : ""}`}>
      <span>{label}</span>
      {children}
      {hint && <em className="field__hint">{hint}</em>}
    </label>
  );
}

/** Money in and out of the form as dollars; the API always speaks cents. */
export function MoneyInput({ cents, onChange, min = 0, placeholder }) {
  const [text, setText] = useState(cents == null ? "" : (cents / 100).toString());
  const last = useRef(cents);
  useEffect(() => {
    if (cents !== last.current) { last.current = cents; setText(cents == null ? "" : (cents / 100).toString()); }
  }, [cents]);

  // A div, not a span: `.field > span` is the label text and would force display:block.
  return (
    <div className="money-in">
      <span aria-hidden="true">$</span>
      <input
        type="number" min={min} step="0.01" inputMode="decimal" value={text} placeholder={placeholder}
        onChange={(e) => {
          setText(e.target.value);
          const n = e.target.value === "" ? null : Math.round(Number(e.target.value) * 100);
          last.current = n;
          onChange(Number.isFinite(n) ? n : null);
        }}
      />
    </div>
  );
}

/** Debounced value, for search boxes that hit the API on every keystroke. */
export function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Loads once and tracks loading/error, so pages don't each rewrite this. */
export function useAsync(fn, deps = []) {
  const [state, setState] = useState({ data: null, error: "", loading: true });
  const reload = useCallback(() => {
    setState((s) => ({ ...s, loading: true }));
    let live = true;
    fn()
      .then((data) => live && setState({ data, error: "", loading: false }))
      .catch((e) => live && setState({ data: null, error: e.message, loading: false }));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  // Concise on purpose here: reload() hands back the "ignore this response" cleanup.
  useEffect(() => reload(), [reload]);
  return useMemo(() => ({ ...state, reload, set: (data) => setState({ data, error: "", loading: false }) }), [state, reload]);
}
