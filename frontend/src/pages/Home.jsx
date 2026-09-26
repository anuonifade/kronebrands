import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import LoopVideo from "../components/LoopVideo";
import ProductCard from "../components/ProductCard";
import VelvetRoom from "../components/VelvetRoom";
import { api } from "../lib/api";
import { media, velvets } from "../lib/media";

export default function Home() {
  const [products, setProducts] = useState([]);
  useEffect(() => { api.products({ featured: true }).then(setProducts).catch(() => {}); }, []);

  // One of each line for the rail (Royal is already covered by the velvet section).
  const rail = products.filter((p, i, arr) => arr.findIndex((q) => q.line === p.line) === i);

  return (
    <>
      <section className="hero">
        <LoopVideo className="hero__media" src={media.heroVideo} poster={media.heroPoster}
                   alt="A magenta velvet Royal loafer under a single spotlight" />
        <div className="hero__copy">
          <h1 className="display hero__title">
            <span className="reveal"><span>Made by hand</span></span>
            <span className="reveal"><span>in Lagos.</span></span>
          </h1>
          <Link className="btn" to="/shop">Shop the collection</Link>
        </div>
      </section>

      <VelvetRoom />

      <section className="rail" aria-labelledby="rail-h">
        <div className="rail__head">
          <h2 id="rail-h" className="h2">The collection</h2>
          <Link className="linkbtn" to="/shop">See all {products.length || ""} styles</Link>
        </div>
        <div className="rail__track">
          {rail.map((p) => <ProductCard key={p.slug} p={p} />)}
        </div>
      </section>

      <section className="split">
        <LoopVideo className="split__media" src={media.lifestyleVideo} poster={media.lifestyle}
                   alt="A man in an ivory kaftan walks down a terrazzo staircase in green velvet loafers" />
        <div className="split__copy">
          <h2 className="display display--md">Dressed for the evening, built for the whole night.</h2>
          <p>
            Velvet reads formal from across a room, but a Kronebrands loafer is unlined at the heel and
            set on a flexible leather sole, so it softens to your foot within a week of wear.
          </p>
          <Link className="linkbtn" to="/shop?category=Velvet loafers">Shop velvet loafers</Link>
        </div>
      </section>

      <section className="split split--flip">
        <LoopVideo className="split__media" src={media.craftVideo} poster={media.craft}
                   alt="Hands stitching a gold crest onto blue velvet" />
        <div className="split__copy">
          <h2 className="display display--md">The crest is stitched, not printed.</h2>
          <p>
            Each crest takes our embroiderers about forty minutes. The upper is then pulled over a
            wooden last by hand and left to set overnight before the sole goes on.
          </p>
          <Link className="linkbtn" to="/about">Visit the atelier</Link>
        </div>
      </section>

      <section className="social" aria-labelledby="social-h">
        <h2 id="social-h" className="h2">Worn by you</h2>
        <a className="linkbtn" href="https://www.instagram.com/kronebrands/" target="_blank" rel="noreferrer">
          @kronebrands on Instagram
        </a>
        <div className="social__grid">
          {[media.lifestyle, velvets[1].img, media.craft, velvets[2].img, media.heroPoster, velvets[0].img].map((src, i) => (
            <a key={i} href="https://www.instagram.com/kronebrands/" target="_blank" rel="noreferrer" aria-label="Open Instagram">
              <img src={src} alt="" loading="lazy" />
            </a>
          ))}
        </div>
      </section>
    </>
  );
}
