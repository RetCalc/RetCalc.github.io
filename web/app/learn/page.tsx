/* Learn: lessons on the ideas behind a retirement plan, open to everyone
   (search engines included). Signed in with a plan, the lessons suggested
   and the numbers inside them are the reader's own; the Dashboard's Learn
   tab shows the same pages inside the Dashboard. */
import type { Metadata } from "next";
import { LearnHome } from "@/components/learn/LearnHome";
import { previews, summaries } from "@/lib/learn/lessons";
import { SITE } from "@/lib/site";

const TITLE = "Learn: retirement planning, explained | RetCalc";
const DESC = "Lessons on saving, investing, withdrawals, taxes, Social Security and Medicare, each tied to a free calculator and, with a plan, to your own numbers.";

export const metadata: Metadata = {
  title: { absolute: TITLE }, description: DESC, alternates: { canonical: `${SITE}/learn` },
  openGraph: { type: "website", siteName: "RetCalc", title: TITLE, description: DESC, url: `${SITE}/learn`, images: [{ url: `${SITE}/og.png`, width: 1200, height: 630 }] },
};

export default function LearnPage() {
  return (
    <div className="lrn-site">
      <header className="lrn-pagehead">
        <span className="lrn-eyebrow">Learn</span>
        <h1>Retirement planning, explained</h1>
        <p>Lessons on the ideas behind your plan, from your first 401(k) to your first withdrawal. Each one goes into the details, then shows you where to try it.</p>
      </header>
      <LearnHome lessons={summaries()} previews={previews()} mode="site" />
    </div>
  );
}
