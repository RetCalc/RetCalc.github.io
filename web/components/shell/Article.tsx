"use client";

/* A page's "about this tool" article. Its HTML is the site's own content
   (content/articles/), so it's set directly; links inside it to other pages
   move within the app instead of reloading. */

import { useRouter } from "next/navigation";
import { toggleCollapse } from "@/lib/collapse";

export function Article({ html }: { html: string }) {
  const router = useRouter();
  return (
    <section
      className="seo"
      id="seoArticles"
      aria-label="About this tool"
      onClick={(e) => {
        const h2 = (e.target as Element).closest?.(".seo-a > h2");
        if (h2) {
          toggleCollapse(h2.parentElement as HTMLElement);
          return;
        }
        const a = (e.target as Element).closest?.("a");
        const href = a?.getAttribute("href");
        if (!href || !href.startsWith("/") || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        router.push(href);
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
