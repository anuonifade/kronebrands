import { useEffect, useRef, useState } from "react";
import LoopVideo from "./LoopVideo";

/** Product gallery: a stacked column of angles on desktop with a thumbnail rail
 *  beside it, and a swipeable snap track with dots on narrow screens. Either way
 *  the visitor scrolls through every shot; the rail and dots just follow along. */
export default function Gallery({ items, alt }) {
  const trackRef = useRef(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    setActive(0);
    const track = trackRef.current;
    if (!track) return;
    track.scrollTo({ left: 0 });

    const slides = [...track.querySelectorAll("[data-slide]")];
    // Whichever slide shows the most of itself is the one the rail and dots point at.
    // A callback only reports the slides that changed, so ratios are kept across calls.
    const ratios = new Map();
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => ratios.set(e.target.dataset.slide, e.intersectionRatio));
        let best = null;
        ratios.forEach((ratio, key) => {
          if (ratio > 0 && (!best || ratio > best.ratio)) best = { key, ratio };
        });
        if (best) setActive(Number(best.key));
      },
      { root: null, threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    slides.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [items]);

  const show = (i) => {
    const slide = trackRef.current?.querySelector(`[data-slide="${i}"]`);
    slide?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    setActive(i);
  };

  return (
    <div className="gallery">
      <div className="gallery__rail" role="tablist" aria-label="Product images">
        {items.map((it, i) => (
          <button
            key={it.src}
            role="tab"
            aria-selected={i === active}
            aria-label={`View image ${i + 1} of ${items.length}`}
            className={`gallery__thumb ${i === active ? "is-on" : ""}`}
            onClick={() => show(i)}
          >
            <img src={it.poster || it.src} alt="" loading="lazy" />
            {it.type === "video" && <span className="gallery__play" aria-hidden="true" />}
          </button>
        ))}
      </div>

      <div className="gallery__track" ref={trackRef}>
        {items.map((it, i) => (
          <figure className="gallery__slide" data-slide={i} key={it.src}>
            {it.type === "video" ? (
              <LoopVideo src={it.src} poster={it.poster} alt={`${alt}, rotating`} />
            ) : (
              <img src={it.src} alt={i === 0 ? alt : `${alt}, view ${i + 1}`} loading={i === 0 ? "eager" : "lazy"} />
            )}
          </figure>
        ))}
      </div>

      <div className="gallery__dots" aria-hidden="true">
        {items.map((it, i) => (
          <span key={it.src} className={`gallery__dot ${i === active ? "is-on" : ""}`} />
        ))}
      </div>
    </div>
  );
}
