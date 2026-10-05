import type { MetadataRoute } from "next";
import { SLUGS, urlFor } from "@/lib/site";

/* Every page, as build.py listed them. */
export default function sitemap(): MetadataRoute.Sitemap {
  return SLUGS.map((slug) => ({ url: urlFor(slug) }));
}
