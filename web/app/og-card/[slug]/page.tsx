/* Link-preview cards, one per page, for scripts/og/render.mjs to save as
   images. Development only: the production build has no pages here. */

import { notFound } from "next/navigation";
import { OgCard } from "@/components/og/OgCard";
import { homeData } from "@/components/home/data";
import { CARDS } from "@/lib/cards";

export const dynamicParams = false;
export const metadata = { robots: { index: false, follow: false } };

export function generateStaticParams() {
  return process.env.NODE_ENV === "development" ? Object.keys(CARDS).map((slug) => ({ slug })) : [];
}

export default async function CardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const card = CARDS[slug as keyof typeof CARDS];
  if (process.env.NODE_ENV !== "development" || !card) notFound();
  return <OgCard card={card} data={homeData()} />;
}
