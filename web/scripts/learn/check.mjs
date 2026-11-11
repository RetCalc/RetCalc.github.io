/* Checks Learn lessons against the authoring guide (content/lessons/README.md):
   the parts every lesson needs, chart data that parses and lines up, links
   to lessons and pages that exist, and the copy rules a search can catch.
   Usage: node scripts/learn/check.mjs [slug ...]   (no slugs: every lesson) */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const dir = join(root, "content", "lessons");
const all = readdirSync(dir).filter((f) => f.endsWith(".html")).map((f) => f.slice(0, -5));
const slugs = process.argv.slice(2).length ? process.argv.slice(2) : all;
const widgetNames = new Set([...readFileSync(join(root, "components/learn/widgets/index.tsx"), "utf8").match(/Element> = \{([\s\S]*?)\};/)[1].matchAll(/"?([\w-]+)"?\s*:/g)].map((m) => m[1]));
const catalog = readFileSync(join(root, "lib/learn/catalog.ts"), "utf8");
const yoursBlock = catalog.slice(catalog.indexOf("export const YOURS"));
const pageExists = (p) => existsSync(join(root, "app", p)) || existsSync(join(root, "app", "(tools)", p)) || existsSync(join(root, "content", "articles", p + ".html"));

let bad = 0;
for (const slug of slugs) {
  const file = join(dir, slug + ".html");
  const errs = [], warns = [];
  if (!existsSync(file)) { console.log(`✗ ${slug}: no such lesson`); bad++; continue; }
  const html = readFileSync(file, "utf8");
  const open = html.match(/<article[^>]*>/)?.[0] ?? "";
  const at = (n) => (open.match(new RegExp(`${n}="([^"]*)"`)) ?? open.match(new RegExp(`${n}='([^']*)'`)))?.[1] ?? null;
  if (at("data-slug") !== slug) errs.push(`data-slug is "${at("data-slug")}"`);
  for (const a of ["data-title", "data-idea", "data-reviewed"]) if (!at(a)) errs.push(`missing ${a}`);
  if ((at("data-title") ?? "").length > 44) warns.push(`title is ${at("data-title").length} characters`);
  if ((at("data-idea") ?? "").length > 70) warns.push(`idea is ${at("data-idea").length} characters (limit 70)`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(at("data-reviewed") ?? "")) errs.push("data-reviewed isn't a date");
  if (!/<p class="lede">/.test(html)) errs.push("no lede");
  if (!/<section class="insum"><h2 id="short">/.test(html)) errs.push('no <section class="insum"><h2 id="short">');
  const foot = html.match(/<footer>([\s\S]*?)<\/footer>/)?.[1] ?? "";
  const list = (c) => [...(foot.match(new RegExp(`<ul class="${c}">([\\s\\S]*?)</ul>`))?.[1] ?? "").matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((m) => m[1]);
  const points = list("points"), terms = list("terms"), deeper = list("deeper");
  if (points.length !== 3) errs.push(`${points.length} points (need exactly 3)`);
  points.forEach((p) => { if (p.replace(/<[^>]+>/g, "").length > 60) warns.push(`point over 60 characters: "${p}"`); });
  if (terms.length < 2 || terms.length > 4) errs.push(`${terms.length} key terms (need 2 to 4)`);
  if (deeper.length < 2 || deeper.length > 8) errs.push(`${deeper.length} Go deeper links (need 2 to 8)`);
  deeper.forEach((d) => { if (!/<a href="https?:\/\/[^"]+">[\s\S]+<\/a>\s*<span>[\s\S]+<\/span>/.test(d)) errs.push(`Go deeper entry isn't <a href="https://…">Title</a> <span>Publisher</span>: ${d.slice(0, 70)}`); });

  const body = html.slice(0, html.indexOf("<footer>") < 0 ? html.length : html.indexOf("<footer>"));
  const h2s = [...body.matchAll(/<h2([^>]*)>/g)];
  const ids = h2s.map((m) => m[1].match(/id="([^"]+)"/)?.[1]);
  if (ids.some((i) => !i)) errs.push("an <h2> has no id");
  if (new Set(ids).size !== ids.length) errs.push("two <h2>s share an id");

  // Charts: valid JSON, every series as long as x, known keys.
  const figs = [...body.matchAll(/<figure([^>]*)>([\s\S]*?)<\/figure>/g)];
  let pictures = 0;
  for (const f of figs) {
    pictures++;
    if (!/<figcaption>[\s\S]+?<\/figcaption>/.test(f[2])) errs.push("a figure has no caption");
    const c = f[1].match(/data-chart='([^']*)'/);
    const w = f[1].match(/data-widget="([^"]+)"/);
    if (w && !widgetNames.has(w[1])) errs.push(`unknown widget "${w[1]}"`);
    if (/data-chart="/.test(f[1])) errs.push("data-chart must be in single quotes");
    if (!c) continue;
    let spec;
    try { spec = JSON.parse(c[1]); } catch (e) { errs.push(`chart JSON doesn't parse: ${e.message}`); continue; }
    if (!["line", "area", "bar"].includes(spec.type)) errs.push(`chart type "${spec.type}"`);
    if (!Array.isArray(spec.x) || !spec.x.length) errs.push("chart has no x");
    if (!Array.isArray(spec.series) || !spec.series.length || spec.series.length > 5) errs.push("chart needs 1 to 5 series");
    for (const s of spec.series ?? []) {
      if (!Array.isArray(s.values) || s.values.length !== spec.x.length) errs.push(`chart series "${s.name}" has ${s.values?.length} values for ${spec.x?.length} x`);
      if (s.tone && !["good", "bad", "accent", "neutral", "muted"].includes(s.tone)) errs.push(`chart tone "${s.tone}"`);
      if (spec.y === "pct" && s.values.some((v) => v != null && Math.abs(v) > 3)) warns.push(`chart series "${s.name}" is "pct" but has values over 300% (write 4% as 0.04)`);
    }
    for (const k of Object.keys(spec)) if (!["type", "x", "xLabel", "xFormat", "y", "series", "marks", "band", "stack", "labels", "levels"].includes(k)) errs.push(`chart key "${k}" isn't supported`);
    for (const m of spec.marks ?? []) if (typeof m.x === "string" && !spec.x.includes(m.x)) errs.push(`chart mark at "${m.x}" isn't an x value`);
  }
  if (!pictures) errs.push("no picture (table, chart or widget)");
  // A comment saying how the figures were worked out, before each picture.
  const noNote = [...body.matchAll(/(<!--[\s\S]*?-->)?\s*<figure/g)].filter((m) => !m[1]).length;
  if (noNote) warns.push(`${noNote} figure(s) without a "<!-- data: … -->" comment before them`);

  const hasYours = /<p data-yours><\/p>/.test(body), listed = new RegExp(`"${slug}":`).test(yoursBlock);
  if (hasYours && !listed) errs.push("has <p data-yours> but isn't in YOURS (lib/learn/catalog.ts)");
  if ((body.match(/<p data-yours><\/p>/g) ?? []).length > 1) errs.push("more than one <p data-yours>");

  // Links to lessons and pages that exist.
  for (const m of html.matchAll(/href="\/learn\/([\w-]+)(#[\w-]+)?"/g)) if (!all.includes(m[1])) errs.push(`links to a lesson that doesn't exist: /learn/${m[1]}`);
  for (const m of body.matchAll(/href="\/([\w-]+)(#[\w-]+)?"/g)) if (m[1] !== "learn" && !pageExists(m[1])) warns.push(`links to /${m[1]}: check that page exists`);
  for (const m of body.matchAll(/<(\w+)[\s>]/g)) if (!["article", "p", "h2", "h3", "ul", "ol", "li", "figure", "figcaption", "table", "thead", "tbody", "tr", "th", "td", "details", "summary", "section", "b", "i", "a", "sub", "sup"].includes(m[1])) errs.push(`tag <${m[1]}> isn't allowed`);
  if (/ style="/.test(body)) errs.push("inline style");

  // Copy rules, on the words only.
  const text = html.replace(/<!--[\s\S]*?-->/g, "").replace(/data-chart='[^']*'/g, "").replace(/<[^>]+>/g, " ");
  if (/—/.test(text)) errs.push("em dash");
  const per = text.match(/[^.]{0,40}(\$[\d,.]+(?: (?:million|billion))?|\d%|\bdollars) a (year|month)\b/g);
  if (per) errs.push(`"a year"/"a month" (write "per year"/"per month"): ${per.slice(0, 3).map((s) => `"…${s.trim()}"`).join(", ")}`);
  if (/\b(Erik|Peyton)\b/.test(text)) errs.push("uses the owner's names");
  if (/\d-\$?\d{4}\b|\b\d{4}-\d{2,4}\b/.test(text.replace(/\d{4}-\d{2}-\d{2}/g, ""))) warns.push("a number range with a hyphen (use an en dash)");
  const words = text.split(/\s+/).length;
  if (words < 1500) warns.push(`${words} words (short)`);

  if (errs.length) bad++;
  if (errs.length || warns.length) {
    console.log(`${errs.length ? "✗" : "•"} ${slug}`);
    errs.forEach((e) => console.log(`    error: ${e}`));
    warns.forEach((w) => console.log(`    note:  ${w}`));
  }
}
console.log(bad ? `\n${bad} lesson(s) with errors` : `\n${slugs.length} lesson(s) pass`);
process.exit(bad ? 1 : 0);
