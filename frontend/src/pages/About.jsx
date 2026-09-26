import LoopVideo from "../components/LoopVideo";
import { media } from "../lib/media";

export default function About() {
  return (
    <div className="about">
      <LoopVideo className="about__media" src={media.craftVideo} poster={media.craft} alt="Hands stitching a gold crest onto velvet" />
      <div className="about__copy">
        <h1 className="display display--md">The atelier</h1>
        <p>
          Kronebrands started in Lagos with a simple brief: shoes with the presence of formalwear and the comfort of
          something you forget you're wearing. Every pair is cut, stitched and lasted by hand in our workshop.
        </p>
        <p>
          Our velvet loafers use a dense cotton velvet that holds its colour, over a leather sole and insole. The
          Krone crest on the Royal line is embroidered by hand in gold thread.
        </p>
        <h2 className="h2" id="sizing">Sizing</h2>
        <p>We make EU sizes 39 to 46. Our lasts run true to size; if you're between sizes, take the smaller one.
          Unworn pairs can be exchanged for a different size free within 30 days.</p>
        <h2 className="h2">Contact</h2>
        <p>Lagos, Nigeria. <a href="mailto:kronebrands@gmail.com">kronebrands@gmail.com</a></p>
      </div>
    </div>
  );
}
