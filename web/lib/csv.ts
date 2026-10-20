/* CSV downloads. Every file carries the link that reopens the page with the
   inputs that made it, in the first row one column past the table's last, so
   a long link doesn't stretch the table's own first column; the BOM makes
   Excel read UTF-8 correctly on Windows. From src/js/app/19-widgets-theme.js. */

export const csvEscape = (v: string) => (/[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v);

export function csvSlug(t: string): string {
  return (t || "table").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "table";
}

/** Saves `rows` as `filename`, with `link` in the first row after the last column. */
export function downloadCsv(rows: string[][], filename: string, link: string): void {
  const width = Math.max(0, ...rows.map((r) => r.length));
  const out = rows.map((r) => r.slice());
  if (!out.length) out.push([]);
  while (out[0].length < width) out[0].push("");
  out[0].push(link);
  const csv = "﻿" + out.map((r) => r.map(csvEscape).join(",")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
