/* Lesson tables: text columns read from the left, figures line up on the
   right. Lessons carry no classes (content/lessons/README.md), so this
   marks each column whose body cells are all figures ($76,000, −20%, 4.0%,
   1974, 25 years) with class="num" on its header and cells. The first
   column holds the rows' labels and always stays on the left. */

const BLANK = /^(|—|–|-|n\/a)$/i;
// A figure: $76,000, −20%, 4.0%, $1.2 million, 26 years 5 months, 6%, $3,600,
// $0 to $12,400. Nothing may be left once figures and units are taken out.
const FIG = /[−–+\-~≈]?\$?\d[\d,]*(?:\.\d+)?\s?(?:%|K|M|B|x|×)?/g;
const UNIT = /\b(?:years?|months?|million|billion|per|year|month|of|to|and|over|under|up|about)\b|[\s,–\-/()]/gi;
const isNum = (t: string) => /\d/.test(t) && t.replace(FIG, "").replace(UNIT, "") === "";

const text = (cell: string) => cell.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&[a-z]+;|&#\d+;/g, "x").trim();

function markTable(table: string): string {
  const rows = table.match(/<tr\b[\s\S]*?<\/tr>/g);
  if (!rows) return table;
  const CELL = /<(th|td)\b([^>]*)>([\s\S]*?)<\/\1>/g;
  // Each row's cells, placed by column (colspan counted).
  const grid = rows.map((r) => {
    const out: { col: number; tag: string; body: string; span: number }[] = [];
    let col = 0;
    for (const m of r.matchAll(CELL)) {
      const span = +(m[2].match(/colspan="?(\d+)/)?.[1] ?? 1);
      out.push({ col, tag: m[1], body: m[3], span });
      col += span;
    }
    return out;
  });
  const cols = Math.max(0, ...grid.map((r) => r.reduce((t, c) => t + c.span, 0)));
  const num = new Set<number>();
  for (let c = 1; c < cols; c++) {
    const cells = grid.flatMap((r) => r.filter((x) => x.col === c && x.span === 1 && x.tag === "td").map((x) => text(x.body))).filter((t) => !BLANK.test(t));
    if (cells.length && cells.every(isNum)) num.add(c);
  }
  if (!num.size) return table;
  let i = 0;
  return table.replace(/<tr\b[\s\S]*?<\/tr>/g, (row) => {
    const r = grid[i++];
    let k = 0;
    return row.replace(CELL, (all, tag: string, attrs: string, body: string) => {
      const cell = r[k++];
      if (!cell || cell.span !== 1 || !num.has(cell.col)) return all;
      const a = /class="/.test(attrs) ? attrs.replace(/class="/, 'class="num ') : `${attrs} class="num"`;
      return `<${tag}${a}>${body}</${tag}>`;
    });
  });
}

/** Every table in a piece of lesson HTML, with its figure columns marked. */
export function markNumberColumns(html: string): string {
  return html.includes("<table") ? html.replace(/<table\b[\s\S]*?<\/table>/g, markTable) : html;
}
