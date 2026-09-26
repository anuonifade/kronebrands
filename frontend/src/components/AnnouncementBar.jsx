import { useEffect, useState } from "react";

const MESSAGES = [
  "Free shipping on orders over $500",
  "Every pair is hand-lasted in our Lagos workshop",
  "Free size exchanges within 30 days",
];

export default function AnnouncementBar() {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setI((n) => (n + 1) % MESSAGES.length), 4500);
    return () => clearInterval(t);
  }, [paused]);

  return (
    <div className="announce" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <p key={i} className="announce__msg" aria-live="polite">{MESSAGES[i]}</p>
    </div>
  );
}
