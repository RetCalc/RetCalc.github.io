/* What every page has inside <main>: the main heading (the tool's own name
   on a tool's page), the tool header, the saved scenarios (in the tool
   header, or a bar of their own on the calculator's pages), the page's
   content, and its "about this tool" article. */

import { articleHtml } from "@/lib/articles";
import { jsonLdFor } from "@/lib/seo";
import { PAGES, TOOL_SUB, hasToolControls, isStrategyPage, strategyLede, type Slug } from "@/lib/site";
import { TOOLS } from "@/lib/tools";
import { Article } from "./Article";
import { StrategyLinks, StrategyLedeLinks } from "./StrategyLinks";
import { ScenarioBar } from "./ScenarioBar";
import { ToolBar } from "./ToolBar";
import { ToolHeader } from "./ToolHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function PageShell({ slug, children }: { slug: Slug; children: React.ReactNode }) {
  const meta = PAGES[slug];
  const sub = TOOL_SUB[slug];
  // A strategy page opens its article: it explains the very setup on screen.
  const strategy = isStrategyPage(slug);
  const article = articleHtml(slug, strategy);
  const ld = JSON.stringify(jsonLdFor(slug)).replace(/</g, "\\u003c");
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld }} />
      {sub ? null : <h1 className="srlive" id="pageH1">{meta.h1 ?? "RetCalc"}</h1>}
      {sub ? <ToolHeader sub={sub} name={meta.h1 ?? TOOLS[sub].name} desc={strategyLede(slug) ?? TOOLS[sub].desc}
        full={strategy} more={strategy ? <StrategyLedeLinks hasArticle={!!article} /> : null}
        controls={hasToolControls(slug) ? <ScenarioBar /> : null} /> : null}
      {!sub && hasToolControls(slug) ? <ToolBar /> : null}
      {children}
      {strategy ? <StrategyLinks current={slug} /> : null}
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
