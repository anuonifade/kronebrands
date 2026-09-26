import { useState } from "react";
import { Link } from "react-router-dom";
import { velvets } from "../lib/media";

/** The signature section: choosing a velvet re-dyes the whole room. */
export default function VelvetRoom() {
  const [active, setActive] = useState(velvets[3]);
  return (
    <section className="velvet" style={{ "--velvet": active.hex, "--velvet-ink": active.ink }} aria-labelledby="velvet-h">
      <div className="velvet__copy">
        <h2 id="velvet-h" className="display">The Royal,<br />in five velvets</h2>
        <p>
          Cotton velvet with a dense, short pile, the Krone crest stitched in gold thread,
          and a leather sole lasted by hand. Choose a colour.
        </p>
        <div className="velvet__swatches" role="radiogroup" aria-label="Velvet colour">
          {velvets.map((v) => (
            <button
              key={v.key}
              role="radio"
              aria-checked={v.key === active.key}
              className="swatch"
              style={{ "--sw": v.hex }}
              onClick={() => setActive(v)}
            >
              <span className="swatch__dot" />
              <span className="swatch__label">{v.label}</span>
            </button>
          ))}
        </div>
        <Link className="btn btn--velvet" to={`/product/royal-crested-${active.key}-velvet-loafers`}>
          Shop the {active.label.toLowerCase()} Royal, $250
        </Link>
      </div>
      <div className="velvet__stage">
        {velvets.map((v) => (
          <img key={v.key} src={v.img} alt={v.key === active.key ? `Royal loafer in ${v.label.toLowerCase()} velvet` : ""}
               className={v.key === active.key ? "is-active" : ""} />
        ))}
      </div>
    </section>
  );
}
