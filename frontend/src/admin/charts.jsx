import { useLayoutEffect, useRef, useState } from "react";
import { money } from "../lib/format";

/** Real pixel width of a container, so strokes stay 2px instead of being scaled
 *  by a stretched viewBox. */
function useWidth() {
  const ref = useRef(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    setW(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

const niceMax = (n) => {
  if (n <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(n));
  return Math.ceil(n / pow) * pow;
};

const shortDate = (iso) =>
  new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/**
 * Revenue over time. One series, so no legend — the panel title names it. The
 * crosshair reads the nearest day; only the first, middle and last dates are
 * labelled, rather than a number on every point.
 */
export function RevenueChart({ series, height = 220 }) {
  const [ref, w] = useWidth();
  const [hover, setHover] = useState(null);

  const pad = { t: 12, r: 12, b: 24, l: 52 };
  const iw = Math.max(0, w - pad.l - pad.r);
  const ih = height - pad.t - pad.b;
  const max = niceMax(Math.max(...series.map((d) => d.revenue_cents), 0));
  const x = (i) => (series.length < 2 ? iw / 2 : (i / (series.length - 1)) * iw);
  const y = (v) => ih - (v / max) * ih;

  const line = series.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d.revenue_cents).toFixed(1)}`).join(" ");
  const area = series.length ? `${line} L${x(series.length - 1).toFixed(1)},${ih} L${x(0).toFixed(1)},${ih} Z` : "";
  const ticks = [0, max / 2, max];
  const labelAt = [0, Math.floor((series.length - 1) / 2), series.length - 1];

  const onMove = (e) => {
    const box = e.currentTarget.getBoundingClientRect();
    const rel = e.clientX - box.left - pad.l;
    const i = Math.max(0, Math.min(series.length - 1, Math.round((rel / iw) * (series.length - 1))));
    setHover(i);
  };

  return (
    <div className="chart" ref={ref}>
      {w > 0 && (
        <svg
          width={w} height={height} className="chart__svg"
          role="img"
          aria-label={`Revenue per day over the last ${series.length} days. Highest day ${money(max)}.`}
          onPointerMove={onMove} onPointerLeave={() => setHover(null)}
        >
          <g transform={`translate(${pad.l},${pad.t})`}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1="0" x2={iw} y1={y(t)} y2={y(t)} className="chart__grid" />
                <text x="-10" y={y(t)} dy="0.32em" textAnchor="end" className="chart__tick">{money(t)}</text>
              </g>
            ))}
            <path d={area} className="chart__area" />
            <path d={line} className="chart__line" />

            {hover !== null && (
              <g>
                <line x1={x(hover)} x2={x(hover)} y1="0" y2={ih} className="chart__cross" />
                <circle cx={x(hover)} cy={y(series[hover].revenue_cents)} r="5" className="chart__dot" />
              </g>
            )}

            {labelAt.map((i) =>
              series[i] ? (
                <text key={i} x={x(i)} y={ih + 18} className="chart__tick"
                      textAnchor={i === 0 ? "start" : i === series.length - 1 ? "end" : "middle"}>
                  {shortDate(series[i].date)}
                </text>
              ) : null,
            )}
          </g>
        </svg>
      )}

      {hover !== null && series[hover] && (
        <div
          className="chart__tip"
          style={{ left: `${pad.l + x(hover)}px`, transform: `translateX(${hover > series.length / 2 ? "-100%" : "0"})` }}
        >
          <strong>{shortDate(series[hover].date)}</strong>
          <span>{money(series[hover].revenue_cents)}</span>
          <span className="muted">{series[hover].orders} order{series[hover].orders === 1 ? "" : "s"}</span>
        </div>
      )}

      <details className="chart__table">
        <summary>View as table</summary>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Day</th><th>Revenue</th><th>Orders</th></tr></thead>
            <tbody>
              {series.filter((d) => d.orders > 0).map((d) => (
                <tr key={d.date}><td>{shortDate(d.date)}</td><td>{money(d.revenue_cents)}</td><td>{d.orders}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

/**
 * Horizontal bars in one hue: the job here is magnitude, and each row carries its
 * own label, so colour isn't asked to tell the rows apart.
 */
export function BarList({ rows, format = (v) => v, empty = "Nothing yet." }) {
  const max = Math.max(...rows.map((r) => r.value), 0);
  if (!rows.length || max === 0) return <p className="muted small">{empty}</p>;
  return (
    <ul className="bars">
      {rows.map((r) => (
        <li key={r.key ?? r.label} className="bar">
          <span className="bar__label">{r.label}</span>
          <span className="bar__track">
            <span className="bar__fill" style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }} />
          </span>
          <span className="bar__value">{format(r.value)}</span>
        </li>
      ))}
    </ul>
  );
}

/** A headline number. No plot, so no hover layer. */
export function Stat({ label, value, sub, tone = "" }) {
  return (
    <div className={`stat ${tone ? `stat--${tone}` : ""}`}>
      <p className="stat__label">{label}</p>
      <p className="stat__n">{value}</p>
      {sub && <p className="stat__sub muted small">{sub}</p>}
    </div>
  );
}

