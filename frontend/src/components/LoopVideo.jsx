import { useEffect, useRef, useState } from "react";

const prefersReduced = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Muted looping video that only plays while on screen; falls back to the poster
 *  image when there is no video or the visitor prefers reduced motion. */
export default function LoopVideo({ src, poster, alt = "", className = "" }) {
  const ref = useRef(null);
  const [still] = useState(prefersReduced);

  useEffect(() => {
    const el = ref.current;
    if (!el || !src || still) return;
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? el.play().catch(() => {}) : el.pause()), {
      threshold: 0.15,
    });
    io.observe(el);
    return () => io.disconnect();
  }, [src, still]);

  if (!src || still) return <img src={poster} alt={alt} className={className} />;
  return (
    <video
      ref={ref}
      className={className}
      src={src}
      poster={poster}
      muted
      loop
      playsInline
      preload="metadata"
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
    />
  );
}
