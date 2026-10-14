/* The tool list (/tools): every tool, by section, as chart cards or compact
   tiles (ToolsBrowser). The cards are links, so each tool's address can be
   followed by anything that reads the page. */

import { type ToolCard as Tool } from "@/lib/tools";
import { TOOLS_VIEW_SCRIPT } from "@/lib/tools-view-script";
import type { PickerData } from "./picker-data";
import { ToolCardLink } from "./ToolCardLink";
import { ToolIconTile } from "./ToolIcon";
import { ToolsBrowser } from "./ToolsBrowser";
import { Badge } from "@/components/ui/badge";

/** One tool's card: its icon, name and arrow on one row, the description
    under them at the card's full width. Used by the 404 page. */
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

export function ToolPicker({ data }: { data: PickerData }) {
  return (
    <div className="stack solo" role="tabpanel" aria-labelledby="tabbtn-tools" id="tab-toolpicker">
      {/* Before the list is drawn: show it the way it was left (lib/tools-view-script.ts). */}
      <script dangerouslySetInnerHTML={{ __html: TOOLS_VIEW_SCRIPT }} />
      <ToolsBrowser data={data} />
    </div>
  );
}
