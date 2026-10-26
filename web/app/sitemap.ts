import type { MetadataRoute } from "next";
import lastmod from "@/lib/lastmod.json";
import { SITE, SLUGS, urlFor } from "@/lib/site";
import { lesson, summaries } from "@/lib/learn/lessons";

/* Every page, with the date its article, route or tool last changed
   (lib/lastmod.json, written by scripts/lastmod.mjs), then Learn and each
   lesson, dated by its last review. */
export default function sitemap(): MetadataRoute.Sitemap {
  const dates = lastmod as Record<string, string>;
  const lessons = summaries().map((l) => ({ url: `${SITE}/learn/${l.slug}`, lastModified: lesson(l.slug)?.reviewed ?? undefined }));
  const newest = lessons.map((l) => l.lastModified).filter(Boolean).sort().pop();
  return [...SLUGS.map((slug) => ({ url: urlFor(slug), lastModified: dates[slug] })), { url: `${SITE}/learn`, lastModified: newest }, ...lessons];
}
