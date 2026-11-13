/* The plan spreadsheet's look, in the site's own palette ("Clear Glass"):
   near-black ink on white, soft grey panels, amber and gold accents, the
   chart colors for bars, and every sheet opening with the RetCalc mark.
   And the small writer every sheet uses: the header band, sections, label
   and value rows, and tables whose totals and derived columns are formulas.
   Inputs you can change are amber on a light amber fill, as the site's
   fields are; everything else is worked out. Column A is a narrow margin;
   content starts in B. Two flavors share it: Excel (Aptos, data bars,
   linked contents) and Google Sheets (Inter, color scales, which survive
   the import). */

import type { Workbook, Worksheet, Cell, Fill, Font, Alignment } from "exceljs";

export const C = {
  ink: "FF1D1D1F", muted: "FF6E6E73", faint: "FF8E8E93", rule: "FFE5E5EA", hair: "FFEFEFF4",
  ground: "FFF5F5F7", band: "FFFAFAFC", white: "FFFFFFFF", navy: "FF1B2333",
  amber: "FF975300", gold: "FFE9B872", goldSoft: "FFFDF6EA", inFill: "FFFFF7EB",
  gain: "FF1F7A35", gainSoft: "FFE8F5EC", loss: "FFC4000F", lossSoft: "FFFDECEE",
  sky: "FF2F7FC4", skySoft: "FFE8F2FB", teal: "FF1F8F7E", tealSoft: "FFE6F5F2",
  jade: "FF2E9C74", jadeSoft: "FFE7F6EF", lav: "FF7A5FC0", lavSoft: "FFF0ECFA", rose: "FFC4486F", roseSoft: "FFFBEAF0",
};

/** The flavor being built: set once per workbook (buildWorkbook). */
export const theme = { font: "Aptos", display: "Aptos Display", bars: true, links: true };
export function setFlavor(f: "excel" | "sheets") {
  if (f === "sheets") Object.assign(theme, { font: "Inter", display: "Inter", bars: false, links: false });
  else Object.assign(theme, { font: "Aptos", display: "Aptos Display", bars: true, links: true });
}

/** Number formats: dollars with a dash for zero, percents, plain numbers. */
export const F = {
  money: '"$"#,##0;[Red]-"$"#,##0;"–"',
  pct: '0.0%;[Red]-0.0%;"–"',
  pct0: "0%",
  pts: '+0" pts";[Red]-0" pts";"0 pts"',
  int: "0",
  num: "#,##0",
  year: "0",
  months: '0.0" months"',
  date: "mmm d, yyyy",
  text: "@",
};

const fill = (argb: string): Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const line = (argb = C.rule, style: "thin" | "medium" | "hair" = "thin") => ({ style, color: { argb } });

/** "A" for 1, "AB" for 28. */
export function col(n: number): string {
  let s = "";
  for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}
/** A cell as another sheet's formula refers to it: 'Net Worth'!$C$5. */
export const ref = (sheet: string, c: number, r: number, abs = true) => `'${sheet.replace(/'/g, "''")}'!${abs ? "$" : ""}${col(c)}${abs ? "$" : ""}${r}`;

export type Fmt = keyof typeof F;
export type Val = string | number | Date | null | undefined | { formula: string; result?: number | string } | { text: string; hyperlink: string };

/** One column of a table: its heading, format, and either a value from each
    row or a formula built from the row's number and the table's column
    letters. `total`: "sum", a label, or a formula from the first and last
    data rows (the total row is the one after the last). */
export interface Col<T> {
  key: string; h: string; fmt?: Fmt; align?: "left" | "right" | "center";
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

/** The RetCalc mark and name as one image, its id in the workbook and size in pixels. */
export interface Mark { id: number; w: number; h: number }

export class Sheet {
  ws: Worksheet; name: string; r = 1; c0 = 2;
  /** The column label and value rows put their value in (the label spans the columns before it). */
  kvAt = 4;
  /** The first row under the header band. */
  top = 7;
  constructor(wb: Workbook, name: string, tab: string, widths: number[]) {
    this.name = name;
    this.ws = wb.addWorksheet(name, {
      properties: { tabColor: { argb: tab }, defaultRowHeight: 19 },
      views: [{ showGridLines: false, zoomScale: 110 }],
      pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.6, header: 0.3, footer: 0.3 } },
      headerFooter: { oddFooter: `&L&8RetCalc · retcalc.app · &A&R&8Page &P of &N` },
    });
    this.ws.columns = [{ width: 2.5 }, ...widths.map((w) => ({ width: w }))];
  }
  cell(c: number, r = this.r): Cell { return this.ws.getCell(r, c); }
  /** Puts a value or formula, with a format and font. */
  put(c: number, v: Val, o: { fmt?: Fmt; font?: Partial<Font>; fill?: string; align?: Partial<Alignment>; r?: number } = {}): Cell {
    const cell = this.cell(c, o.r ?? this.r);
    cell.value = (v ?? null) as Cell["value"];
    cell.font = { name: theme.font, size: 10.5, color: { argb: C.ink }, ...o.font };
    if (o.fmt) cell.numFmt = F[o.fmt];
    if (o.fill) cell.fill = fill(o.fill);
    cell.alignment = { vertical: "middle", ...o.align };
    return cell;
  }
  /** A formula with its figure into a cell already styled (its format kept, or given). */
  setF(c: number, r: number, formula: string, result?: number | string | null, fmt?: Fmt) {
    const cell = this.cell(c, r);
    cell.value = { formula, ...(result != null ? { result } : {}) } as Cell["value"];
    if (fmt) cell.numFmt = F[fmt];
  }
  skip(n = 1) { this.r += n; return this; }

  /** The header band: the RetCalc mark and name, the site's address at the
      right, the sheet's title, the household and date, a gold rule. */
  title(t: string, sub: string, span: number, mark: Mark | null) {
    const last = this.c0 + span - 1;
    this.ws.getRow(1).height = 10;
    // The mark and the name as one picture (they can't overlap in any app),
    // or, without one, the name in type.
    const h = mark ? mark.h : 0;
    this.ws.getRow(2).height = Math.max(26, h * 0.75 + 6);
    if (mark) this.ws.addImage(mark.id, { tl: { col: this.c0 - 1, row: 1 + 3 / (h * 0.75 + 6) }, ext: { width: mark.w, height: mark.h }, editAs: "absolute" } as never);
    else this.put(this.c0, "RetCalc", { r: 2, font: { name: theme.display, size: 16, bold: true, color: { argb: C.ink } } });
    this.ws.mergeCells(2, last - 1, 2, last);
    this.put(last - 1, theme.links ? { text: "retcalc.app", hyperlink: "https://retcalc.app" } : "retcalc.app", { r: 2, font: { size: 9.5, color: { argb: C.faint } }, align: { horizontal: "right" } });
    this.ws.getRow(3).height = 10;
    this.ws.getRow(4).height = 34;
    this.put(this.c0, t, { r: 4, font: { name: theme.display, size: 24, bold: true, color: { argb: C.ink } } });
    this.ws.getRow(5).height = 20;
    this.put(this.c0, sub, { r: 5, font: { size: 10, color: { argb: C.muted } } });
    for (let c = this.c0; c <= last; c++) this.cell(c, 5).border = { bottom: line(C.gold, "medium") };
    this.ws.getRow(6).height = 12;
    this.r = this.top = 7;
    return this;
  }
  /** A section heading: dark and semibold with a gold mark at its left. */
  section(t: string, span = 6, note?: string) {
    this.ws.getRow(this.r).height = 26;
    const h = this.put(this.c0, t, { font: { name: theme.display, size: 13.5, bold: true, color: { argb: C.ink } }, align: { indent: 1 } });
    h.border = { left: { style: "thick", color: { argb: C.gold } } };
    this.r++;
    if (note) this.note(note, span);
    return this;
  }
  /** A line of small grey words across the section. */
  note(t: string, span = 6) {
    this.ws.mergeCells(this.r, this.c0, this.r, this.c0 + span - 1);
    let w = 0;
    for (let c = this.c0; c < this.c0 + span; c++) w += this.ws.getColumn(c).width ?? 10;
    const lines = Math.max(1, Math.ceil(t.length / Math.max(30, w * 1.15)));
    this.ws.getRow(this.r).height = 14 * lines + 6;
    this.put(this.c0, t, { font: { size: 9.5, color: { argb: C.muted } }, align: { wrapText: true, vertical: "top" } });
    this.r++;
    return this;
  }
  /** A label, its value, and an optional note: the value cell's address back. */
  kv(label: string, v: Val, fmt?: Fmt, o: { note?: string; input?: boolean; bold?: boolean; valueCol?: number } = {}): string {
    const vc = o.valueCol ?? this.kvAt;
    const text = fmt === "text";
    if (vc - 1 > this.c0) this.ws.mergeCells(this.r, this.c0, this.r, vc - 1);
    this.ws.getRow(this.r).height = 21;
    this.put(this.c0, label, { font: { color: { argb: o.bold ? C.ink : C.muted }, bold: o.bold } });
    // Words run on to the right; figures sit right-aligned with a note beside.
    if (text) this.ws.mergeCells(this.r, vc, this.r, vc + 3);
    const cell = this.put(vc, v, {
      fmt: text ? undefined : fmt, fill: o.input ? C.inFill : undefined,
      font: { bold: o.bold || o.input, color: { argb: o.input ? C.amber : C.ink }, size: o.bold ? 11.5 : 10.5 },
      align: { horizontal: text ? "left" : "right" },
    });
    if (o.note && !text) this.put(vc + 1, o.note, { font: { size: 9.5, color: { argb: C.faint } }, align: { indent: 1 } });
    for (let c = this.c0; c < vc; c++) this.cell(c).border = { bottom: line(C.hair) };
    cell.border = o.input ? { top: line(C.gold), bottom: line(C.gold), left: line(C.gold), right: line(C.gold) } : { bottom: line(C.hair) };
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
    const lastCol = pos(cols.length - 1) + (cols[cols.length - 1].span ?? 1) - 1;
    const alignOf = (c: Col<T>) => c.align ?? (c.fmt && c.fmt !== "text" ? "right" : "left");
    // Group headings over spans of columns.
    if (o.group?.length) {
      this.ws.getRow(this.r).height = 18;
      for (const g of o.group) {
        const a = at.get(g.from)!, b = at.get(g.to)!;
        if (b > a) this.ws.mergeCells(this.r, a, this.r, b);
        this.put(a, g.label.toUpperCase(), { font: { size: 8.5, bold: true, color: { argb: C.faint } }, align: { horizontal: "center" } });
        for (let c = a; c <= b; c++) this.cell(c).border = { bottom: line(C.rule) };
      }
      this.r++;
    }
    const hr = this.r;
    this.ws.getRow(hr).height = o.headHeight ?? 30;
    cols.forEach((c, i) => {
      merge(hr, i);
      this.put(pos(i), c.h, { font: { bold: true, size: 9.5, color: { argb: C.muted } }, fill: C.ground, align: { horizontal: alignOf(c), wrapText: true } });
    });
    for (let c = this.c0; c <= lastCol; c++) { this.cell(c, hr).fill = fill(C.ground); this.cell(c, hr).border = { bottom: line(C.gold) }; }
    this.r++;
    const first = this.r;
    rows.forEach((row, i) => {
      const r = this.r;
      this.ws.getRow(r).height = 20;
      cols.forEach((c, j) => {
        merge(r, j);
        const v: Val = c.f ? { formula: c.f(r, L, row, i), ...(c.res ? { result: c.res(row, i) ?? undefined } : {}) } as Val : c.v ? c.v(row, i) : null;
        const ink = c.ink?.(row, i);
        const cell = this.put(pos(j), v, {
          fmt: c.fmt, fill: c.input ? C.inFill : o.band !== false && i % 2 === 1 ? C.band : undefined,
          font: { color: { argb: ink ?? (c.input ? C.amber : C.ink) }, bold: c.bold || !!ink },
          align: { horizontal: alignOf(c), wrapText: c.wrap },
        });
        cell.border = { bottom: line(C.hair) };
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
      if (lines > 1) this.ws.getRow(r).height = 14.5 * lines + 5;
      this.r++;
    });
    const last = this.r - 1;
    let total: number | null = null;
    if (cols.some((c) => c.total) && rows.length) {
      total = this.r;
      this.ws.getRow(total).height = 22;
      cols.forEach((c, j) => {
        merge(total!, j);
        const t = c.total, label = typeof t === "string" && t !== "sum";
        let v: Val = null;
        if (t === "sum") v = { formula: `SUM(${L(c.key)}${first}:${L(c.key)}${last})`, result: sumOf(rows, c) };
        else if (typeof t === "function") v = { formula: t(first, last, L), ...(c.totalRes != null ? { result: c.totalRes } : {}) };
        else if (label) v = t;
        this.put(pos(j), j === 0 && v == null ? (o.totalLabel ?? "Total") : v, {
          fmt: label ? undefined : c.fmt, font: { bold: true, size: 11 },
          align: { horizontal: j === 0 || label ? "left" : alignOf(c) },
        });
      });
      for (let c = this.c0; c <= lastCol; c++) this.cell(c, total).border = { top: line(C.ink), bottom: line(C.rule) };
      this.r++;
    }
    this.r++;
    return { first, last, total, L, c: (k: string) => at.get(k)! };
  }

  /** Bars in a column (Excel), or a soft color scale (Google Sheets drops data bars). */
  bars(range: string, argb: string, soft: string, max?: number) {
    const hi = max != null ? { type: "num", value: max } : { type: "max" };
    const rule = theme.bars
      ? { type: "dataBar", priority: 1, cfvo: [{ type: "num", value: 0 }, hi], color: { argb } }
      : { type: "colorScale", priority: 1, cfvo: [{ type: "num", value: 0 }, hi], color: [{ argb: C.white }, { argb: soft }] };
    this.ws.addConditionalFormatting({ ref: range, rules: [rule as never] });
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
