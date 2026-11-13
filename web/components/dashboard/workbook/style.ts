/* The plan spreadsheet's look and the small writer every sheet uses: a title
   block, sections, label and value rows, and tables whose totals and
   derived columns are formulas. Conventions, as in financial models: inputs
   you can change are blue on a pale yellow fill; everything black is worked
   out (a formula, or a figure from the plan); totals are bold over a rule.
   Column A is a narrow margin; content starts in B. */

import type { Workbook, Worksheet, Cell, Fill, Font, Alignment } from "exceljs";

export const C = {
  ink: "FF1D1D1F", muted: "FF6E6E73", faint: "FF8E8E93", rule: "FFD2D2D7", hair: "FFE8E8ED",
  band: "FFF5F5F7", head: "FF1D1D1F", headInk: "FFFFFFFF",
  amber: "FF975300", amberSoft: "FFFDF3E3", amberRule: "FFE9B872",
  inInk: "FF1F4E9A", inFill: "FFFFF8DC",
  gain: "FF1F7A35", gainSoft: "FFE6F4EA", loss: "FFC4000F", lossSoft: "FFFDE8EA",
  sky: "FF2F7FC4", teal: "FF1F8F7E", rose: "FFC4486F", lav: "FF7A5FC0", jade: "FF4FBF95",
};
export const FONT = "Calibri";

/** Number formats: dollars with a dash for zero, percents, plain numbers. */
export const F = {
  money: '"$"#,##0;[Red]-"$"#,##0;"–"',
  moneyK: '"$"#,##0,"K";[Red]-"$"#,##0,"K";"–"',
  pct: "0.0%;[Red]-0.0%;\"–\"",
  pct0: "0%",
  pts: '+0" pts";[Red]-0" pts";"0 pts"',
  int: "0",
  num: "#,##0",
  year: "0",
  months: '0.0" months"',
  years: '0" years"',
  date: "mmm d, yyyy",
  text: "@",
};

const fill = (argb: string): Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const thin = (argb = C.rule) => ({ style: "thin" as const, color: { argb } });

/** "A" for 1, "AB" for 28. */
export function col(n: number): string {
  let s = "";
  for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}
/** A sheet's name as a formula refers to it: 'Net Worth'!$C$5. */
export const ref = (sheet: string, c: number, r: number, abs = true) => `'${sheet.replace(/'/g, "''")}'!${abs ? "$" : ""}${col(c)}${abs ? "$" : ""}${r}`;

export type Fmt = keyof typeof F;
export type Val = string | number | Date | null | undefined | { formula: string; result?: number | string };

/** One column of a table: its heading, width, format, and either a value
    from each row or a formula built from the row's number and the table's
    column letters. `total`: "sum", a label, or a formula from the first and
    last data rows. */
export interface Col<T> {
  key: string; h: string; w?: number; fmt?: Fmt; align?: "left" | "right" | "center";
  v?: (row: T, i: number) => Val;
  f?: (r: number, L: (key: string) => string, row: T, i: number) => string;
  /** The formula's figure, for apps that show results without working them out. */
  res?: (row: T, i: number) => number | string | null;
  total?: "sum" | string | ((first: number, last: number, L: (key: string) => string) => string);
  totalRes?: number | string;
  input?: boolean; wrap?: boolean; bold?: boolean;
  /** How many sheet columns it spans (merged), for wide text. */
  span?: number;
  /** A font color for the cell, by row (a status, a warning). */
  ink?: (row: T, i: number) => string | null;
}

export interface TableOut { first: number; last: number; total: number | null; L: (key: string) => string; c: (key: string) => number }

export class Sheet {
  ws: Worksheet; name: string; r = 1; c0 = 2;
  /** The column label and value rows put their value in (the label spans the columns before it). */
  kvAt = 4;
  constructor(wb: Workbook, name: string, tab: string, widths: number[]) {
    this.name = name;
    this.ws = wb.addWorksheet(name, {
      properties: { tabColor: { argb: tab }, defaultRowHeight: 17 },
      views: [{ showGridLines: false, zoomScale: 110 }],
      pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.6, header: 0.3, footer: 0.3 } },
      headerFooter: { oddFooter: `&L&8&"${FONT}"RetCalc · &A&R&8&"${FONT}"Page &P of &N` },
    });
    this.ws.columns = [{ width: 2.5 }, ...widths.map((w) => ({ width: w }))];
  }
  cell(c: number, r = this.r): Cell { return this.ws.getCell(r, c); }
  /** Puts a value or formula, with a format and font. */
  put(c: number, v: Val, o: { fmt?: Fmt; font?: Partial<Font>; fill?: string; align?: Partial<Alignment>; r?: number } = {}): Cell {
    const cell = this.cell(c, o.r ?? this.r);
    cell.value = (v ?? null) as Cell["value"];
    cell.font = { name: FONT, size: 11, color: { argb: C.ink }, ...o.font };
    if (o.fmt) cell.numFmt = F[o.fmt];
    if (o.fill) cell.fill = fill(o.fill);
    if (o.align) cell.alignment = { vertical: "middle", ...o.align };
    else cell.alignment = { vertical: "middle" };
    return cell;
  }
  skip(n = 1) { this.r += n; return this; }

  /** The sheet's title, a line under it, and the household and date. */
  title(t: string, sub: string, span = 6) {
    this.ws.getRow(1).height = 10;
    this.r = 2;
    this.put(this.c0, t, { font: { size: 20, bold: true, color: { argb: C.ink } } });
    this.ws.getRow(2).height = 30;
    this.r = 3;
    this.put(this.c0, sub, { font: { size: 10.5, color: { argb: C.muted } } });
    for (let c = this.c0; c < this.c0 + span; c++) this.cell(c, 3).border = { bottom: { style: "medium", color: { argb: C.amberRule } } };
    this.r = 5;
    return this;
  }
  /** A section heading in amber, ruled underneath across `span` columns. */
  section(t: string, span = 6, note?: string) {
    this.ws.getRow(this.r).height = 22;
    this.put(this.c0, t, { font: { size: 13, bold: true, color: { argb: C.amber } } });
    for (let c = this.c0; c < this.c0 + span; c++) this.cell(c).border = { bottom: thin(C.amberRule) };
    this.r++;
    if (note) this.note(note, span);
    return this;
  }
  /** A line of small grey words across the section. */
  note(t: string, span = 6) {
    this.ws.mergeCells(this.r, this.c0, this.r, this.c0 + span - 1);
    const lines = Math.max(1, Math.ceil(t.length / (span * 15)));
    this.ws.getRow(this.r).height = 15 * lines + 2;
    this.put(this.c0, t, { font: { size: 9.5, italic: true, color: { argb: C.muted } }, align: { wrapText: true, vertical: "top" } });
    this.r++;
    return this;
  }
  /** A label, its value, and an optional note: the value cell's address back. */
  kv(label: string, v: Val, fmt?: Fmt, o: { note?: string; input?: boolean; bold?: boolean; valueCol?: number; noteSpan?: number } = {}): string {
    const vc = o.valueCol ?? this.kvAt;
    const text = fmt === "text";
    this.ws.mergeCells(this.r, this.c0, this.r, vc - 1);
    this.put(this.c0, label, { font: { color: { argb: C.ink }, bold: o.bold } });
    // Words run on to the right; figures sit right-aligned with a note beside.
    if (text) this.ws.mergeCells(this.r, vc, this.r, vc + 3);
    const cell = this.put(vc, v, { fmt: text ? undefined : fmt, font: o.input ? { color: { argb: C.inInk }, bold: o.bold } : { bold: o.bold }, fill: o.input ? C.inFill : undefined, align: { horizontal: text ? "left" : "right" } });
    if (o.input) cell.border = { top: thin(C.amberRule), bottom: thin(C.amberRule), left: thin(C.amberRule), right: thin(C.amberRule) };
    if (o.note && !text) this.put(vc + 1, o.note, { font: { size: 9.5, color: { argb: C.muted } } });
    for (let c = this.c0; c <= vc; c++) this.cell(c).border = { ...(this.cell(c).border ?? {}), bottom: thin(C.hair) };
    const a = ref(this.name, vc, this.r);
    this.r++;
    return a;
  }

  /** A table: a header row, a row per item, an optional total. */
  table<T>(cols: Col<T>[], rows: T[], o: { totalLabel?: string; band?: boolean; group?: { label: string; from: string; to: string }[]; headHeight?: number } = {}): TableOut {
    const at = new Map<string, number>();
    { let x = this.c0; for (const c of cols) { at.set(c.key, x); x += c.span ?? 1; } }
    const pos = (j: number) => at.get(cols[j].key)!;
    const merge = (r: number, j: number) => { const n = cols[j].span ?? 1; if (n > 1) this.ws.mergeCells(r, pos(j), r, pos(j) + n - 1); };
    const L = (k: string) => col(at.get(k)!);
    // Group headings over spans of columns.
    if (o.group?.length) {
      for (const g of o.group) {
        const a = at.get(g.from)!, b = at.get(g.to)!;
        if (b > a) this.ws.mergeCells(this.r, a, this.r, b);
        this.put(a, g.label, { font: { size: 9.5, bold: true, color: { argb: C.muted } }, align: { horizontal: "center" } });
        for (let c = a; c <= b; c++) this.cell(c).border = { bottom: thin(C.rule) };
      }
      this.r++;
    }
    const hr = this.r;
    this.ws.getRow(hr).height = o.headHeight ?? 30;
    cols.forEach((c, i) => {
      merge(hr, i);
      const cell = this.put(pos(i), c.h, { font: { bold: true, size: 10, color: { argb: C.headInk } }, fill: C.head,
        align: { horizontal: c.align ?? (c.fmt && c.fmt !== "text" ? "right" : "left"), wrapText: true } });
      cell.border = { bottom: { style: "thin", color: { argb: C.head } } };
    });
    this.r++;
    const first = this.r;
    rows.forEach((row, i) => {
      const r = this.r;
      cols.forEach((c, j) => {
        merge(r, j);
        const v: Val = c.f ? { formula: c.f(r, L, row, i), ...(c.res ? { result: c.res(row, i) ?? undefined } : {}) } as Val : c.v ? c.v(row, i) : null;
        const ink = c.ink?.(row, i);
        const cell = this.put(pos(j), v, {
          fmt: c.fmt, fill: c.input ? C.inFill : o.band !== false && i % 2 === 1 ? C.band : undefined,
          font: { color: { argb: ink ?? (c.input ? C.inInk : C.ink) }, bold: c.bold, size: 10.5 },
          align: { horizontal: c.align ?? (c.fmt && c.fmt !== "text" ? "right" : "left"), wrapText: c.wrap },
        });
        cell.border = { bottom: thin(C.hair) };
      });
      // Wrapped text: a taller row for as many lines as it needs (Excel won't
      // size rows with merged cells itself).
      let lines = 1;
      cols.forEach((c, j) => {
        if (!c.wrap) return;
        const v = this.cell(pos(j), r).value;
        if (typeof v !== "string") return;
        let w = 0;
        for (let k = 0; k < (c.span ?? 1); k++) w += this.ws.getColumn(pos(j) + k).width ?? 10;
        lines = Math.max(lines, Math.ceil(v.length / Math.max(8, w * 1.05)));
      });
      if (lines > 1) this.ws.getRow(r).height = 14.5 * lines + 3;
      this.r++;
    });
    const last = this.r - 1;
    let total: number | null = null;
    if (cols.some((c) => c.total) && rows.length) {
      total = this.r;
      cols.forEach((c, j) => {
        const t = c.total;
        let v: Val = null;
        if (t === "sum") v = { formula: `SUM(${L(c.key)}${first}:${L(c.key)}${last})`, result: sumOf(rows, c) };
        else if (typeof t === "function") v = { formula: t(first, last, L), ...(c.totalRes != null ? { result: c.totalRes } : {}) };
        else if (typeof t === "string") v = t;
        merge(total!, j);
        const cell = this.put(pos(j), j === 0 && v == null ? (o.totalLabel ?? "Total") : v, {
          fmt: t === "sum" || typeof t === "function" ? c.fmt : undefined, font: { bold: true, size: 10.5 },
          align: { horizontal: j === 0 || (typeof t === "string" && t !== "sum") ? "left" : c.align ?? "right" },
        });
        cell.border = { top: { style: "thin", color: { argb: C.ink } }, bottom: { style: "double", color: { argb: C.ink } } };
      });
      this.r++;
    }
    this.r++;
    return { first, last, total, L, c: (k: string) => at.get(k)! };
  }

  /** Freezes the rows above `row` (and columns before `colN`). */
  freeze(row: number, colN = 1) { this.ws.views = [{ state: "frozen", ySplit: row - 1, xSplit: colN, showGridLines: false, zoomScale: 110 }]; }
}

function sumOf<T>(rows: T[], c: Col<T>): number | undefined {
  let s = 0;
  for (let i = 0; i < rows.length; i++) {
    const v = c.res ? c.res(rows[i], i) : c.v ? c.v(rows[i], i) : null;
    if (typeof v === "number") s += v; else if (v && typeof v === "object" && "result" in v && typeof v.result === "number") s += v.result;
  }
  return s;
}

/** A formula with its figure. */
export const fx = (formula: string, result?: number | string | null): Val => ({ formula, ...(result != null ? { result } : {}) });
