/* Each page's "about this tool" article: what a search engine reads for the
   page, and the plain explanation a first-time visitor needs. They live as
   HTML in content/articles/, moved unchanged from
   src/main/26-about-this-tool.html. Read at build time; server only. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cache } from "react";
import { CHEVRON } from "@/lib/collapse";
import type { Slug } from "@/lib/site";

const DIR = join(process.cwd(), "content", "articles");

const raw = cache((slug: Slug): string | null => {
  try {
    return readFileSync(join(DIR, `${slug}.html`), "utf8");
  } catch {
    return null;
  }
});

/** The article's HTML as shown: collapsed under its heading (open when
    `open`). The heading's text sits in a button (with the chevron) that
    opens it from the mouse or the keyboard (lib/collapse.ts); FAQ questions
    get the same chevron. Null for a
    page without one. */
export const articleHtml = cache((slug: Slug, open = false): string | null => {
  const html = raw(slug);
  if (!html) return null;
  const reviewed = articleReviewed(slug);
  return split(html)
    // "Last reviewed" opens the article's body, from its data-reviewed date.
    .replace(/(<div class="body">\s*(?:<div class="seo-main">)?)/, reviewed ? `$1\n    <p class="reviewed">Last reviewed ${reviewedLabel(reviewed)}.</p>` : "$1")
    .replace('class="seo-a panel about"', open ? 'class="seo-a panel about"' : 'class="seo-a panel about collapsed"')
    .replace(
      /<h2>([\s\S]*?)<\/h2>/,
      `<h2><button type="button" class="seo-a-toggle" aria-expanded="${open}" aria-controls="seoBody">$1${CHEVRON}</button></h2>`,
    )
    .replace(/(<div class="body">[\s\S]*<\/div>)(\s*<\/article>)/, '<div class="about-collapse" id="seoBody">$1</div>$2')
    // Each FAQ question takes the same chevron as the heading, in place of
    // the browser's triangle (details/summary keep the keyboard working).
    .replace(/<summary>([\s\S]*?)<\/summary>/g, `<summary>$1${CHEVRON}</summary>`);
});

/* Where an article's closing sections start, and the order they take in
   the side column: the questions first, then where to go next, then the
   sources. */
const SIDE = ["Questions", "Related tools", "Go further", "Sources"];
const SIDE_H3 = new RegExp(`<h3>(?:${SIDE.join("|")})</h3>`);

/** Splits the body in two: the article itself, and its closing sections
    (SIDE) as a column beside it on a wide card (styles: .seo-main, .seo-side).
    An article without them stays whole. */
function split(html: string): string {
  const open = html.indexOf('<div class="body">'), close = html.lastIndexOf("</div>");
  if (open < 0 || close < open) return html;
  const start = open + '<div class="body">'.length, body = html.slice(start, close);
  const at = body.search(SIDE_H3);
  if (at < 0) return html;
  const sections = body.slice(at).split(/(?=<h3>)/).map((x) => x.trim()).filter(Boolean);
  const rank = (x: string) => SIDE.findIndex((t) => x.startsWith(`<h3>${t}</h3>`));
  sections.sort((x, y) => rank(x) - rank(y));
  return html.slice(0, start) + `\n    <div class="seo-main">${body.slice(0, at)}</div>\n    <aside class="seo-side">\n    ` +
    sections.map((x) => `<section>${x}</section>`).join("\n    ") + "\n    </aside>\n    " + html.slice(close);
}

/** The date (YYYY-MM-DD) an article was last reviewed, from its
    data-reviewed attribute; null when it has none. Only set it when the
    article, its sources and its figures have actually been checked. */
export const articleReviewed = cache((slug: Slug): string | null => {
  const m = raw(slug)?.match(/<article[^>]*data-reviewed="(\d{4}-\d\d-\d\d)"/);
  return m ? m[1] : null;
});

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function reviewedLabel(date: string): string {
  const [y, m] = date.split("-");
  return `${MONTHS[+m - 1]} ${y}`;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
function plain(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) =>
      e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENTITIES[e] ?? m)
    .trim();
}

/** The article's questions and answers (its <details> blocks), for the
    FAQPage structured data search engines read. Same as build.py's faq(). */
export function articleFaq(slug: Slug): { q: string; a: string }[] {
  const html = raw(slug);
  if (!html) return [];
  return [...html.matchAll(/<details><summary>([\s\S]*?)<\/summary><p>([\s\S]*?)<\/p><\/details>/g)].map((m) => ({
    q: plain(m[1]),
    a: plain(m[2]),
  }));
}
