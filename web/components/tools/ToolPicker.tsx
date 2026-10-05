/* The tool list (/tools): every tool as a card, in three groups. Markup from
   src/main/16-tool-picker.html; the cards are links now, so each tool's
   address can be followed by anything that reads the page. */

import Link from "next/link";
import { TOOL_GROUPS } from "@/lib/tools";
import { ToolIcon } from "./ToolIcon";

export function ToolPicker() {
  return (
    <div className="stack solo" role="tabpanel" aria-labelledby="tabbtn-tools" id="tab-toolpicker">
      <div className="toolcards">
        {TOOL_GROUPS.map((g) => (
          <section className="toolgroup" aria-label={g.label} key={g.label}>
            <h2 className="toolgroup-h"><span>{g.title}</span><em>{g.sub}</em></h2>
            <div className="toolgrid">
              {g.cards.map((c) => (
                <Link key={c.sub} href={`/${c.path}`} className="toolcard" style={{ "--i": c.i } as React.CSSProperties} data-pick={c.sub}>
                  <div className="toolcard-icon"><ToolIcon sub={c.sub} /></div>
                  <div className="toolcard-body">
                    <div className="toolcard-name">{c.name}{c.badge ? <span className="beta">{c.badge}</span> : null}</div>
                    <div className="toolcard-desc">{c.desc}</div>
                  </div>
                  <div className="toolcard-arrow">&#8250;</div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
