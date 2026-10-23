/* The Dashboard's other sections, one page each in the rail. */
import type { Metadata } from "next";
import { SectionPage } from "@/components/dashboard/Pages";
import { SECTION_IDS, SECTION_NAMES, type Section } from "@/components/dashboard/sections";

export const dynamicParams = false;

export function generateStaticParams() {
  return SECTION_IDS.filter((s) => s !== "overview").map((section) => ({ section }));
}

export async function generateMetadata({ params }: PageProps<"/dashboard/[section]">): Promise<Metadata> {
  const { section } = await params;
  return { title: { absolute: `${SECTION_NAMES[section as Section]} | Your dashboard | RetCalc` }, robots: { index: false, follow: false } };
}

export default async function Page({ params }: PageProps<"/dashboard/[section]">) {
  const { section } = await params;
  return <SectionPage id={section as Section} />;
}
