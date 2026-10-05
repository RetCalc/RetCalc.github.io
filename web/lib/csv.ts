/* CSV downloads. Every file opens with the link that reopens the page with
   the inputs that made it, alone in the first cell; the BOM makes Excel
   read UTF-8 correctly on Windows. From src/js/app/19-widgets-theme.js. */

export const csvEscape = (v: string) => (/[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v);

export function csvSlug(t: string): string {
  return (t || "table").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "table";
}

/** Saves `rows` as `filename`, under `link`. */
export function downloadCsv(rows: string[][], filename: string, link: string): void {
  const csv = "﻿" + csvEscape(link) + "\r\n" + rows.map((r) => r.map(csvEscape).join(",")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
