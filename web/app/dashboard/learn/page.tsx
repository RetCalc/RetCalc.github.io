/* Learn, inside the Dashboard: the same lessons, suggested from the plan. */
import type { Metadata } from "next";
import { DashLearnHome } from "@/components/learn/DashLearn";
import { previews, summaries } from "@/lib/learn/lessons";

export const metadata: Metadata = { title: { absolute: "Learn | Your Dashboard | RetCalc" }, robots: { index: false, follow: false } };

export default function Page() {
  return <DashLearnHome lessons={summaries()} previews={previews()} />;
}
