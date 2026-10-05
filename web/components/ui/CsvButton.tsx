"use client";

/* The CSV button in a panel's heading. By default it saves the table it's
   pointed at, exactly as on screen; a tool with a list that isn't a table
   (the Budget) passes its own rows. From src/js/app/19-widgets-theme.js. */

import { useToast } from "@/components/shell/Toast";
import { encodeShare, useActiveTool } from "@/components/tools/ToolState";
import { csvSlug, downloadCsv } from "@/lib/csv";

function cellText(el: Element): string {
  const c = el.cloneNode(true) as Element;
  c.querySelectorAll(".tipdot").forEach((x) => x.remove());
  return (c.textContent || "").replace(/\s+/g, " ").trim();
}

type Props = { label: string; title?: string; id?: string } & (
  | { table: React.RefObject<HTMLTableElement | null>; rows?: never; filename?: never }
  | { rows: () => string[][] | null; filename: string; table?: never }
);

export function CsvButton({ label, title = "Download this table as a CSV", id, ...from }: Props) {
  const tool = useActiveTool();
  const toast = useToast();
  return (
    <button type="button" className="btn mini csvbtn" id={id} title={title} aria-label={`Download ${label} as CSV`}
      onClick={() => {
        let rows: string[][] | null;
        if (from.table) {
          const tbl = from.table.current;
          rows = tbl?.querySelector("tbody tr")
            ? [...tbl.querySelectorAll("tr")].map((tr) => [...tr.querySelectorAll("th,td")].map(cellText)).filter((r) => r.length)
            : null;
        } else rows = from.rows();
        if (!rows) {
          toast("Nothing to export yet");
          return;
        }
        const filename = from.filename ?? `retcalc-${csvSlug(tool?.def.id ?? "table")}-${csvSlug(label)}.csv`;
        downloadCsv(rows, filename, location.origin + location.pathname + (tool ? encodeShare(tool.def.id, tool.state) : ""));
        toast("Saved " + filename);
      }}>CSV</button>
  );
}
