/* Where Learn's links go: on the public pages, the site's own addresses;
   inside the Dashboard, its own Learn pages and the Dashboard's copies of
   the tools (filled in from the plan, with Back to the lesson). */
import { TOOL_SUB, type Slug } from "@/lib/site";

export type LearnMode = "site" | "dashboard";

export const learnHome = (mode: LearnMode) => (mode === "dashboard" ? "/dashboard/learn" : "/learn");
export const lessonHref = (mode: LearnMode, slug: string) => `${learnHome(mode)}/${slug}`;

/** A site address as the mode has it; `from` is the page a tool returns to. */
export function hrefIn(mode: LearnMode, href: string, from?: string): string {
  if (mode === "site" || !href.startsWith("/")) return href;
  if (href === "/learn" || href.startsWith("/learn/") || href.startsWith("/learn#")) return "/dashboard" + href;
  const [path, hash = ""] = href.split("#");
  const slug = path.slice(1) as Slug;
  const sub = TOOL_SUB[slug];
  if (sub) return `/dashboard/tools/${sub}${from ? "?from=" + encodeURIComponent(from) : ""}${hash ? "#" + hash : ""}`;
  if (slug === "calculator" || slug === "advanced") return "/dashboard/calculator";
  if (slug === "guide") return "/dashboard";
  return href;
}

/** Every site link inside a lesson's HTML, rewritten for the mode. */
export function rewriteLinks(mode: LearnMode, html: string, from?: string): string {
  if (mode === "site") return html;
  return html.replace(/href="(\/[^"]*)"/g, (_, h: string) => `href="${hrefIn(mode, h, from)}"`);
}
