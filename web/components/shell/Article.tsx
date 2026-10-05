"use client";

/* A page's "about this tool" article. Its HTML is the site's own content
   (content/articles/), so it's set directly; links inside it to other pages
   move within the app instead of reloading. */

import { useRouter } from "next/navigation";

export function Article({ html }: { html: string }) {
  const router = useRouter();
  return (
    <section
      className="seo"
      id="seoArticles"
      aria-label="About this tool"
      onClick={(e) => {
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
