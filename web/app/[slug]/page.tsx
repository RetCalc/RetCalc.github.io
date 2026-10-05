/* Every address except the home page: /advanced, /drawdown, /roth, ...
   Each is pre-built at deploy time with its own <head> (lib/seo.ts); an
   address not in page-meta.json is a 404. */

import { notFound } from "next/navigation";
import { PageShell, Placeholder } from "@/components/shell/PageShell";
import { ToolPicker } from "@/components/tools/ToolPicker";
import { metadataFor } from "@/lib/seo";
import { PAGES, SLUGS, TOOL_SUB, type Slug } from "@/lib/site";
import { TOOLS } from "@/lib/tools";

export const dynamicParams = false;

export function generateStaticParams() {
  return SLUGS.filter((s) => s !== "home").map((slug) => ({ slug }));
}

function known(slug: string): slug is Slug {
  return slug in PAGES && slug !== "home";
}

export async function generateMetadata({ params }: PageProps<"/[slug]">) {
  const { slug } = await params;
  return known(slug) ? metadataFor(slug) : {};
}

export default async function Page({ params }: PageProps<"/[slug]">) {
  const { slug } = await params;
  if (!known(slug)) notFound();
  const sub = TOOL_SUB[slug];
  return (
    <PageShell slug={slug}>
      {slug === "tools" ? <ToolPicker /> : <Placeholder what={sub ? TOOLS[sub].name : PAGES[slug].h1 ?? "About RetCalc"} />}
    </PageShell>
  );
}
