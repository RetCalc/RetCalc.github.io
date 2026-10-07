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

/* Start here (doc 3, D9): the two ways in for someone who doesn't know
   which tool to open, above the groups. Neither is in the tool list, so
   each card has its own simple icon. */
const START = [
  { href: "/guide", id: "guide", name: "Retirement Readiness Guide",
    desc: "One question at a time, in about ten minutes: your number, a readiness score and the moves that matter most, with a lesson on every card.",
    icon: <svg viewBox="0 0 40 40" fill="none"><circle cx="20" cy="20" r="13" stroke="currentColor" strokeWidth="2" /><circle cx="20" cy="20" r="7" stroke="currentColor" strokeWidth="2" />
      <circle cx="20" cy="20" r="1.8" fill="currentColor" /><path d="M8 32 18.5 21.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg> },
  { href: "/", id: "basic", name: "Retirement calculator",
    desc: "Six questions: what your savings grow to by retirement, in today's dollars, and whether it lasts.",
    icon: <svg viewBox="0 0 40 40" fill="none"><path d="M5 33h30" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><path d="M7 29 C15 27 22 22 33 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M27 9h6v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg> },
];

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
        <section className="toolgroup" aria-label="Start here" data-start="">
          <h2 className="toolgroup-h"><span>Start here</span><em>Not sure which tool you need? Begin with one of these.</em></h2>
          <div className="toolgrid">
            {START.map((c, i) => (
              <ToolCardLink key={c.id} href={c.href} sub={c.id} i={i}>
                <div className="toolcard-top">
                  <span className="toolcard-icon" aria-hidden="true">{c.icon}</span>
                  <div className="toolcard-name">{c.name}</div>
                  <div className="toolcard-arrow">&#8250;</div>
                </div>
                <div className="toolcard-desc">{c.desc}</div>
              </ToolCardLink>
            ))}
          </div>
        </section>
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
