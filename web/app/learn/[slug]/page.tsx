/* One lesson, at its public address (content/lessons/<slug>.html). */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LessonPage } from "@/components/learn/LessonPage";
import { TRACKS } from "@/lib/learn/catalog";
import { lesson, nextOf, plain, summaries } from "@/lib/learn/lessons";
import { SITE } from "@/lib/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return summaries().map((l) => ({ slug: l.slug }));
}

export async function generateMetadata({ params }: PageProps<"/learn/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const l = lesson(slug);
  if (!l) return {};
  const title = `${l.title} | Learn | RetCalc`, desc = plain(l.lede).slice(0, 300), url = `${SITE}/learn/${slug}`;
  return {
    title: { absolute: title }, description: desc, alternates: { canonical: url },
    openGraph: { type: "article", siteName: "RetCalc", title, description: desc, url, images: [{ url: `${SITE}/og.png`, width: 1200, height: 630 }] },
  };
}

export default async function Page({ params }: PageProps<"/learn/[slug]">) {
  const { slug } = await params;
  const l = lesson(slug);
  if (!l) notFound();
  const track = TRACKS.find((t) => t.id === l.track)!;
  const ld = JSON.stringify({
    "@context": "https://schema.org", "@type": "Article", headline: l.title, description: plain(l.lede),
    ...(l.reviewed ? { dateModified: l.reviewed } : {}), url: `${SITE}/learn/${slug}`,
    publisher: { "@type": "Organization", name: "RetCalc", url: SITE },
    isPartOf: { "@type": "CollectionPage", name: "Learn", url: `${SITE}/learn` },
  }).replace(/</g, "\\u003c");
  return (
    <div className="lrn-site">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld }} />
      <LessonPage lesson={l} next={nextOf(slug)} track={track} mode="site" />
    </div>
  );
}
