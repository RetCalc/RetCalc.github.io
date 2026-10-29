/* One lesson, inside the Dashboard. */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DashLesson } from "@/components/learn/DashLearn";
import { TRACKS } from "@/lib/learn/catalog";
import { lesson, nextOf, summaries } from "@/lib/learn/lessons";

export const dynamicParams = false;

export function generateStaticParams() {
  return summaries().map((l) => ({ slug: l.slug }));
}

export async function generateMetadata({ params }: PageProps<"/dashboard/learn/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  return { title: { absolute: `${lesson(slug)?.title ?? "Learn"} | Your Dashboard | RetCalc` }, robots: { index: false, follow: false } };
}

export default async function Page({ params }: PageProps<"/dashboard/learn/[slug]">) {
  const { slug } = await params;
  const l = lesson(slug);
  if (!l) notFound();
  return <DashLesson lesson={l} next={nextOf(slug)} track={TRACKS.find((t) => t.id === l.track)!} />;
}
