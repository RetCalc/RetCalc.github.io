"use client";

/* The CSV button in a table panel's heading. What downloads is exactly the
   table on screen, under a link that reopens the page with the same inputs.
   From src/js/app/19-widgets-theme.js. */

import { encodeShare, useActiveTool } from "@/components/tools/ToolState";
import { useToast } from "@/components/shell/Toast";

const esc = (v: string) => (/[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v);
const slug = (t: string) => (t || "table").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "table";

function cellText(el: Element): string {
  const c = el.cloneNode(true) as Element;
  c.querySelectorAll(".tipdot").forEach((x) => x.remove());
  return (c.textContent || "").replace(/\s+/g, " ").trim();
}

export function CsvButton({ table, label }: { table: React.RefObject<HTMLTableElement | null>; label: string }) {
  const tool = useActiveTool();
  const toast = useToast();
  return (
    <button type="button" className="btn mini csvbtn" title="Download this table as a CSV" aria-label={`Download ${label} as CSV`}
      onClick={() => {
        const tbl = table.current;
        if (!tbl?.querySelector("tbody tr")) {
          toast("Nothing to export yet");
          return;
        }
        const lines = [...tbl.querySelectorAll("tr")]
          .map((tr) => [...tr.querySelectorAll("th,td")].map((c) => esc(cellText(c))).join(","))
          .filter(Boolean);
        const link = location.origin + location.pathname + (tool ? encodeShare(tool.def.id, tool.state) : "");
        // The BOM makes Excel open UTF-8 correctly on Windows.
        const blob = new Blob(["﻿" + esc(link) + "\r\n" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `retcalc-${slug(tool?.def.id ?? "table")}-${slug(label)}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        toast("Saved " + a.download);
      }}>CSV</button>
  );
}
