/* A strategy page's ways on: the full Drawdown Simulator, how this strategy
   works (the page's article), and the other seven strategy pages. Plain
   links; nothing typed here travels with them. */

import Link from "next/link";
import { PAGES, STRATEGY_PAGES, type Slug } from "@/lib/site";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LINK = buttonVariants({ variant: "link", size: "inline" });

/** Under the page's description, in its header. */
export function StrategyLedeLinks({ hasArticle }: { hasArticle: boolean }) {
  return (
    <p className="mt-1.5 mb-0 flex flex-wrap gap-x-4 gap-y-1 text-note">
      <Link href="/drawdown" className={LINK} id="ddFullLink">Run the full simulator</Link>
      {hasArticle ? <a href="#seoArticles" className={LINK}>How it works</a> : null}
    </p>
  );
}

/* "4% Rule Calculator" reads as "4% Rule" in a list of calculators. */
const short = (slug: Slug) => (PAGES[slug].h1 ?? slug).replace(/ Calculator$/, "");

/** Above the article: the eight strategy pages, this one marked, and the
    full simulator. */
export function StrategyLinks({ current }: { current: Slug }) {
  return (
    <nav aria-labelledby="ddOtherH" className="col-span-full" id="ddOtherStrategies">
      <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="ddOtherH" className="m-0 text-body font-semibold text-foreground">Other strategies</h2>
        <Link href="/drawdown" className={cn(LINK, "text-note")}>All of them in the full simulator</Link>
      </div>
      <ul className="m-0 grid list-none grid-cols-2 gap-x-5 gap-y-2.5 p-0 text-note sm:grid-cols-4">
        {STRATEGY_PAGES.map((slug) => (
          <li key={slug} className="min-w-0">
            {slug === current
              ? <span aria-current="page" className="font-semibold text-foreground">{short(slug)}</span>
              : <Link href={"/" + slug} className={cn(LINK, "whitespace-normal")}>{short(slug)}</Link>}
          </li>
        ))}
      </ul>
    </nav>
  );
}
