/* The homepage, to come (HOMEPAGE_BRIEF.md). The Basic calculator, which
   used to live here, is at /calculator. */

import Link from "next/link";
import { metadataFor } from "@/lib/seo";

export const metadata = metadataFor("home");

/* A Basic share link from before the move (retcalc.app/#s=...) opens Basic
   with its numbers, as it always did. Runs before the page paints. */
const FORWARD = `if(location.hash.indexOf("#s=")===0)location.replace("/calculator"+location.hash)`;

export default function HomePage() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: FORWARD }} />
      <h1>RetCalc</h1>
      <p><Link href="/calculator">Open the Calculator</Link></p>
    </>
  );
}
