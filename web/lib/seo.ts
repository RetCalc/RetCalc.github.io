/* Each page's <head>: title, description, canonical address, link-preview
   tags and structured data. The same output as build.py's head(), so search
   engines see no change when the site switches over. */
import type { Metadata } from "next";
import { articleFaq, articleReviewed } from "@/lib/articles";
import { CARDS, cardAlt } from "@/lib/cards";
import { PAGES, SITE, TOOL_SUB, isStrategyPage, urlFor, type Slug } from "@/lib/site";

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

/** The page's place in the site, for the BreadcrumbList: the strategy pages
    sit under the Drawdown Simulator, /72t and /rmd under the tool they open,
    Advanced under the Calculator, the other tools under Tools. */
function crumbs(slug: Slug): Slug[] {
  if (slug === "home") return [];
  if (isStrategyPage(slug)) return ["home", "drawdown", slug];
  if (slug === "72t") return ["home", "tools", "bridge", slug];
  if (slug === "rmd") return ["home", "tools", "roth", slug];
  if (slug === "advanced") return ["home", "calculator", slug];
  if (TOOL_SUB[slug]) return ["home", "tools", slug];
  return ["home", slug];
}

/** The name a page goes by in a breadcrumb: its main heading, else its title's name. */
function crumbName(slug: Slug): string {
  if (slug === "home") return "RetCalc";
  if (slug === "tools") return "Tools";
  return PAGES[slug].h1 ?? appName(PAGES[slug].title);
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
    ...(articleReviewed(slug) ? { dateModified: articleReviewed(slug) } : {}),
  }];
  if (slug === "home") graph.unshift({ "@type": "WebSite", name: "RetCalc", url });
  const trail = crumbs(slug);
  if (trail.length) {
    graph.push({
      "@type": "BreadcrumbList",
      itemListElement: trail.map((s, i) => ({ "@type": "ListItem", position: i + 1, name: crumbName(s), item: urlFor(s) })),
    });
  }
  const faq = articleFaq(slug);
  if (faq.length) {
    graph.push({
      "@type": "FAQPage",
      mainEntity: faq.map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
    });
  }
  return { "@context": "https://schema.org", "@graph": graph };
}
