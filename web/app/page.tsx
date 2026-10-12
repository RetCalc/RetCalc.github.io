/* The homepage: an introduction to the site, with no tool on it
   (components/home/Home.tsx). The Basic calculator, which used to live
   here, is at /calculator. */

import { Home } from "@/components/home/Home";
import { homeData } from "@/components/home/data";
import { jsonLdFor, metadataFor } from "@/lib/seo";

export const metadata = metadataFor("home");

/* A Basic share link from before the move (retcalc.app/#s=...) opens Basic
   with its numbers, as it always did. Runs before the page paints. */
const FORWARD = `if(location.hash.indexOf("#s=")===0)location.replace("/calculator"+location.hash)`;

export default function HomePage() {
  const ld = JSON.stringify(jsonLdFor("home")).replace(/</g, "\\u003c");
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: FORWARD }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld }} />
      <Home data={homeData()} />
    </>
  );
}
