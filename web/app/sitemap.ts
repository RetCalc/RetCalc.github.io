import type { MetadataRoute } from "next";
import lastmod from "@/lib/lastmod.json";
import { SLUGS, urlFor } from "@/lib/site";

/* Every page, with the date its article, route or tool last changed
   (lib/lastmod.json, written by scripts/lastmod.mjs). */
export default function sitemap(): MetadataRoute.Sitemap {
  const dates = lastmod as Record<string, string>;
  return SLUGS.map((slug) => ({ url: urlFor(slug), lastModified: dates[slug] }));
}
