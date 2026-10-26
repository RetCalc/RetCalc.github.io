/* Learn's lessons, read from content/lessons/<slug>.html at build time
   (content/lessons/README.md says how one is written). Each is taken apart
   into what the page lays out: the title and the lines about it, the
   text cut where a chart, widget or Your numbers line goes, the sections
   for "In this lesson", and the footer's lists. Server only. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cache } from "react";
import { LESSON_SLUGS, TRACKS, YOURS, placeOf, type YoursKey } from "./catalog";

const DIR = join(process.cwd(), "content", "lessons");

/** A chart drawn from the lesson's own data (content/lessons/README.md). */
export interface ChartSpec {
  type: "line" | "area" | "bar";
  x: (number | string)[];
  xLabel?: string;
  /** How numeric x values are written: plain (the default), as money or as percents. */
  xFormat?: "money" | "pct" | "num";
  y?: "money" | "pct" | "num";
  series: { name: string; values: (number | null)[]; tone?: "good" | "bad" | "accent" | "neutral" | "muted"; dash?: boolean; step?: boolean }[];
  marks?: { x: number | string; label: string }[];
  band?: { from: number; to: number; label?: string };
}

/** A piece of the lesson's text: HTML as written, or a picture or line the page draws. */
export type Segment =
  | { kind: "html"; html: string }
  | { kind: "chart"; spec: ChartSpec; caption: string }
  | { kind: "widget"; name: string; caption: string }
  | { kind: "yours" };

/** What a lesson's list entry needs (the Learn home, suggestions, search). */
export interface LessonSummary {
  slug: string; title: string; idea: string; minutes: number; tool: string; points: string[];
  track: string; number: string;
}

export interface Lesson extends LessonSummary {
  tryText: string; reviewed: string | null; lede: string;
  segments: Segment[];
  toc: { id: string; text: string }[];
  terms: { term: string; def: string }[];
  deeper: { href: string; title: string; source: string }[];
  yours: YoursKey | null;
  /** The lesson's first chart or widget, for a preview on the Learn home. */
  preview: Segment | null;
}

const raw = cache((slug: string): string | null => {
  try {
    return readFileSync(join(DIR, `${slug}.html`), "utf8");
  } catch {
    return null;
  }
});

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”", ndash: "–", mdash: "—", minus: "−", times: "×", frac12: "½" };
export function plain(html: string): string {
  return html.replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]+>/g, "")
    .replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) =>
      e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENTITIES[e] ?? m)
    .replace(/\s+/g, " ").trim();
}
const attr = (tag: string, name: string): string | null => {
  const m = tag.match(new RegExp(`${name}="([^"]*)"`)) ?? tag.match(new RegExp(`${name}='([^']*)'`));
  return m ? m[1] : null;
};
const items = (html: string, cls: string): string[] => {
  const m = html.match(new RegExp(`<ul class="${cls}">([\\s\\S]*?)</ul>`));
  return m ? [...m[1].matchAll(/<li([^>]*)>([\s\S]*?)<\/li>/g)].map((x) => x[1] + "\u0000" + x[2].trim()) : [];
};
const caption = (fig: string) => fig.match(/<figcaption>([\s\S]*?)<\/figcaption>/)?.[1].trim() ?? "";

/** Reading time at about 220 words per minute, prose only. */
function minutesOf(html: string): number {
  return Math.max(3, Math.round(plain(html).split(" ").length / 220));
}

function parse(slug: string, html: string): Lesson {
  const open = html.match(/<article[^>]*>/)?.[0] ?? "";
  const body = html.slice(html.indexOf(open) + open.length, html.search(/<footer>|<\/article>/)).replace(/<!--[\s\S]*?-->/g, "");
  const foot = html.match(/<footer>([\s\S]*?)<\/footer>/)?.[1] ?? "";
  const place = placeOf(slug);
  const ledeM = body.match(/<p class="lede">([\s\S]*?)<\/p>/);
  const rest = ledeM ? body.replace(ledeM[0], "") : body;

  // Cut the text at each chart, widget and Your numbers line.
  const segments: Segment[] = [];
  const re = /<figure data-chart='([^']*)'>([\s\S]*?)<\/figure>|<figure data-widget="([^"]+)">([\s\S]*?)<\/figure>|<p data-yours><\/p>/g;
  let at = 0;
  for (const m of rest.matchAll(re)) {
    const before = rest.slice(at, m.index).trim();
    if (before) segments.push({ kind: "html", html: before });
    if (m[1] != null) {
      try {
        segments.push({ kind: "chart", spec: JSON.parse(m[1].replace(/&apos;/g, "'")) as ChartSpec, caption: caption(m[2]) });
      } catch {
        throw new Error(`content/lessons/${slug}.html: a chart's data isn't valid JSON`);
      }
    } else if (m[3] != null) segments.push({ kind: "widget", name: m[3], caption: caption(m[4]) });
    else segments.push({ kind: "yours" });
    at = m.index + m[0].length;
  }
  const tail = rest.slice(at).trim();
  if (tail) segments.push({ kind: "html", html: tail });

  const toc = [...rest.matchAll(/<h2 id="([^"]+)">([\s\S]*?)<\/h2>/g)].map((m) => ({ id: m[1], text: plain(m[2]) }));
  const yours = YOURS[slug] ?? null;
  return {
    slug,
    title: attr(open, "data-title") ?? slug,
    idea: attr(open, "data-idea") ?? "",
    tool: attr(open, "data-tool") ?? "",
    tryText: attr(open, "data-try") ?? "",
    reviewed: attr(open, "data-reviewed"),
    minutes: minutesOf(body),
    points: items(foot, "points").map((x) => x.split("\u0000")[1]),
    track: place?.track.id ?? "",
    number: place?.number ?? "",
    lede: ledeM ? ledeM[1].trim() : "",
    segments: yours ? segments : segments.filter((s) => s.kind !== "yours"),
    toc,
    terms: items(foot, "terms").map((x) => { const [a, def] = x.split("\u0000"); return { term: attr(a, "data-term") ?? "", def: plain(def) }; }),
    deeper: items(foot, "deeper").map((x) => {
      const inner = x.split("\u0000")[1];
      const a = inner.match(/<a href="([^"]+)">([\s\S]*?)<\/a>/);
      return { href: a?.[1] ?? "", title: plain(a?.[2] ?? inner), source: plain(inner.match(/<span>([\s\S]*?)<\/span>/)?.[1] ?? "") };
    }),
    yours,
    preview: segments.find((s) => s.kind === "chart" || s.kind === "widget") ?? null,
  };
}

/** A lesson, or null if it isn't written yet. */
export const lesson = cache((slug: string): Lesson | null => {
  const html = raw(slug);
  return html ? parse(slug, html) : null;
});

/** Every written lesson's list entry, in the curriculum's order. */
export const summaries = cache((): LessonSummary[] =>
  LESSON_SLUGS.map((s) => lesson(s)).filter((l): l is Lesson => l != null).map((l) => ({
    slug: l.slug, title: l.title, idea: l.idea, minutes: l.minutes, tool: l.tool, points: l.points, track: l.track, number: l.number,
  })));

/** The lesson after this one: the next in its track, else the next track's first. */
export function nextOf(slug: string): LessonSummary | null {
  const order = summaries(), i = order.findIndex((l) => l.slug === slug);
  return i >= 0 && i + 1 < order.length ? order[i + 1] : null;
}

/** What the Learn home shows beside a suggested lesson: its first
    picture, or, for a lesson without one, its sections. */
export type Preview = Segment | { kind: "toc"; items: string[] };

export const previews = cache((): Record<string, Preview> => {
  const out: Record<string, Preview> = {};
  for (const t of TRACKS) for (const s of t.lessons) {
    const l = lesson(s);
    if (l) out[s] = l.preview ?? { kind: "toc", items: l.toc.map((x) => x.text) };
  }
  return out;
});

/** Whether a lesson links to a site page. */
export function lessonLinksTo(slug: string, page: string): boolean {
  return (raw(slug) ?? "").includes(`href="/${page}"`) || (raw(slug) ?? "").includes(`href="/${page}#`);
}
