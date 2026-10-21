/* One tool's card, for the 404 page. Kept apart from the tool list
   (ToolPicker), which the 404 page would otherwise bring, with all its
   charts, into every page of the site. */

import { type ToolCard as Tool } from "@/lib/tools";
import { ToolCardLink } from "./ToolCardLink";
import { ToolIconTile } from "./ToolIcon";
import { Badge } from "@/components/ui/badge";

/** One tool's card: its icon, name and arrow on one row, the description
    under them at the card's full width. */
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
