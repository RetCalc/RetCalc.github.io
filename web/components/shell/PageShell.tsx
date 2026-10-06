/* What every page has inside <main>, in the old site's order: the main
   heading (the tool's own name on a tool's page), the household bar, the
   tool header, the page's content, and its "about this tool" article. */

import { HouseholdBar } from "@/components/household/HouseholdBar";
import { articleHtml } from "@/lib/articles";
import { STATE_OPTIONS } from "@/lib/states";
import { jsonLdFor } from "@/lib/seo";
import { PAGES, TOOL_SUB, type Slug } from "@/lib/site";
import { TOOLS } from "@/lib/tools";
import { Article } from "./Article";
import { ToolHeader } from "./ToolHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function PageShell({ slug, children }: { slug: Slug; children: React.ReactNode }) {
  const meta = PAGES[slug];
  const sub = TOOL_SUB[slug];
  const article = articleHtml(slug);
  const ld = JSON.stringify(jsonLdFor(slug)).replace(/</g, "\\u003c");
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld }} />
      {sub ? null : <h1 className="srlive" id="pageH1">{meta.h1 ?? "RetCalc"}</h1>}
      {/* About keeps it under Appearance; the homepage offers it after the
          result (tools/basic/Basic.tsx). */}
      {slug === "about" || slug === "home" ? null : <HouseholdBar states={STATE_OPTIONS} />}
      {sub ? <ToolHeader sub={sub} name={meta.h1 ?? TOOLS[sub].name} desc={TOOLS[sub].desc} /> : null}
      {children}
      {article ? <Article html={article} /> : null}
    </>
  );
}

/** Stands in for a page whose tool hasn't been rebuilt yet. */
export function Placeholder({ what }: { what: string }) {
  return (
    <div className="stack solo">
      <Card>
        <CardHeader><CardTitle>{what}</CardTitle></CardHeader>
        <CardContent><p className="hint">This part of RetCalc is being rebuilt. It works today at retcalc.app.</p></CardContent>
      </Card>
    </div>
  );
}
