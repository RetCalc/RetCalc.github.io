/* The pages not rebuilt yet, each showing a "being rebuilt" placeholder.
   A rebuilt page gets its own folder (app/mortgage/page.tsx, ...), so it
   loads only its own tool's code; this route goes away with the last one. */

import { readdirSync } from "node:fs";
import { join } from "node:path";
import { notFound } from "next/navigation";
import { PageShell, Placeholder } from "@/components/shell/PageShell";
import { metadataFor } from "@/lib/seo";
import { PAGES, SLUGS, TOOL_SUB, type Slug } from "@/lib/site";
import { TOOLS } from "@/lib/tools";

export const dynamicParams = false;

/* Addresses that already have their own folder beside this one. */
const OWN = new Set(readdirSync(join(process.cwd(), "app"), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name));
const PENDING = SLUGS.filter((s) => s !== "home" && !OWN.has(s));

export function generateStaticParams() {
  return PENDING.map((slug) => ({ slug }));
}

function pending(slug: string): slug is Slug {
  return (PENDING as string[]).includes(slug);
}

export async function generateMetadata({ params }: PageProps<"/[slug]">) {
  const { slug } = await params;
  return pending(slug) ? metadataFor(slug) : {};
}

export default async function Page({ params }: PageProps<"/[slug]">) {
  const { slug } = await params;
  if (!pending(slug)) notFound();
  const sub = TOOL_SUB[slug];
  return (
    <PageShell slug={slug}>
      <Placeholder what={sub ? TOOLS[sub].name : PAGES[slug].h1 ?? "About RetCalc"} />
    </PageShell>
  );
}
