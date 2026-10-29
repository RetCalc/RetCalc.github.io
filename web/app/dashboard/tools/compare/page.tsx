/* Compare, inside the Dashboard: saved Basic and Advanced scenarios side
   by side, opened from the Advanced Calculator's scenario bar. */
import type { Metadata } from "next";
import { ComparePage } from "@/components/dashboard/ToolsPage";

export const metadata: Metadata = { title: { absolute: "Compare scenarios | Your dashboard | RetCalc" }, robots: { index: false, follow: false } };

export default function Page() {
  return <ComparePage />;
}
