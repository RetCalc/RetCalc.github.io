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

/** The article's HTML as shown: collapsed under its heading, with the
    chevron that opens it (lib/collapse.ts). Null for a page without one. */
export const articleHtml = cache((slug: Slug): string | null => {
  const html = raw(slug);
  if (!html) return null;
  return html
    .replace('class="seo-a panel about"', 'class="seo-a panel about collapsed"')
    .replace(/<\/h2>/, CHEVRON + "</h2>")
    .replace(/(<div class="body">[\s\S]*<\/div>)(\s*<\/article>)/, '<div class="about-collapse">$1</div>$2');
});

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
