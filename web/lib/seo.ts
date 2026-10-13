/* Each page's <head>: title, description, canonical address, link-preview
   tags and structured data. The same output as build.py's head(), so search
   engines see no change when the site switches over. */
import type { Metadata } from "next";
import { articleFaq } from "@/lib/articles";
import { CARDS, cardAlt } from "@/lib/cards";
import { PAGES, SITE, urlFor, type Slug } from "@/lib/site";

function card(slug: Slug): { url: string; alt: string } {
  const c = slug !== "home" ? CARDS[slug] : undefined;
  return c ? { url: `${SITE}/og/${slug}.jpg`, alt: cardAlt(c) } : { url: `${SITE}/og.png`, alt: cardAlt(CARDS.home!) };
}

export function metadataFor(slug: Slug): Metadata {
  const { title, desc } = PAGES[slug];
  const url = urlFor(slug);
  const img = card(slug);
  return {
    title: { absolute: title },
    description: desc,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: "RetCalc",
      title,
      description: desc,
      url,
      images: [{ url: img.url, width: 1200, height: 630, alt: img.alt }],
    },
    twitter: { card: "summary_large_image", images: [img.url] },
  };
}

/** The app's name for structured data: the title without its " | RetCalc"
    ending, or, for titles that don't end that way, the part before the colon. */
function appName(title: string): string {
  const brand = " | RetCalc";
  if (title.endsWith(brand)) return title.slice(0, -brand.length);
  return title.split(":")[0];
}

/** schema.org data for the page: the calculator itself, the site's name on
    the home page (Google shows it above the address), and the article's FAQ. */
export function jsonLdFor(slug: Slug): object {
  const { title, desc } = PAGES[slug];
  const url = urlFor(slug);
  const graph: object[] = [{
    "@type": "WebApplication", name: appName(title), url, description: desc,
    applicationCategory: "FinanceApplication", operatingSystem: "Any", browserRequirements: "Requires JavaScript",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  }];
  if (slug === "home") graph.unshift({ "@type": "WebSite", name: "RetCalc", url });
  const faq = articleFaq(slug);
  if (faq.length) {
    graph.push({
      "@type": "FAQPage",
      mainEntity: faq.map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
    });
  }
  return { "@context": "https://schema.org", "@graph": graph };
}
