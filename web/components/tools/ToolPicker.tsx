/* The tool list (/tools): every tool as a card, in three groups. Markup from
   src/main/16-tool-picker.html; the cards are links now, so each tool's
   address can be followed by anything that reads the page. */

import { TOOL_GROUPS, type ToolCard as Tool } from "@/lib/tools";
import { ToolCardLink } from "./ToolCardLink";
import { ToolIconTile } from "./ToolIcon";
import { Badge } from "@/components/ui/badge";

/** One tool's card: its icon, name and arrow on one row, the description
    under them at the card's full width. Also used by the 404 page. */
export function ToolCard({ c }: { c: Tool }) {
  return (
    <ToolCardLink href={`/${c.path}`} sub={c.sub} i={c.i}>
      <div className="toolcard-top">
        <ToolIconTile sub={c.sub} className="toolcard-icon" />
        <div className="toolcard-name">{c.name}{c.badge ? <Badge variant="highlight" className="ml-1.75 align-middle">{c.badge}</Badge> : null}</div>
        <div className="toolcard-arrow">&#8250;</div>
      </div>
      <div className="toolcard-desc">{c.desc}</div>
    </ToolCardLink>
  );
}

export function ToolPicker() {
  return (
    <div className="stack solo" role="tabpanel" aria-labelledby="tabbtn-tools" id="tab-toolpicker">
      <div className="toolcards">
        {/* The page's h1 ("Financial Planning Calculators") is read by
            search engines and screen readers (PageShell); this is its
            visible face, so it is hidden from screen readers. Set like a
            tool's own header (toolhead-*). */}
        <div className="mb-7">
          <p className="toolhead-name" aria-hidden="true">Tools</p>
          <p className="toolhead-desc">Every tool, grouped by the question it answers.</p>
        </div>
        {TOOL_GROUPS.map((g) => (
          <section className="toolgroup" aria-label={g.label} key={g.label}>
            <h2 className="toolgroup-h"><span>{g.title}</span><em>{g.sub}</em></h2>
            <div className="toolgrid">
              {g.cards.map((c) => <ToolCard key={c.sub} c={c} />)}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
