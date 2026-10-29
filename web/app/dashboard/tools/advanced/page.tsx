/* The Advanced calculator, inside the Dashboard: every input open, filled
   in from your plan, nothing it does reaching the plan. */
import type { Metadata } from "next";
import { ToolPage } from "@/components/dashboard/ToolsPage";

export const metadata: Metadata = { title: { absolute: "Advanced Calculator | Your dashboard | RetCalc" }, robots: { index: false, follow: false } };

export default function Page() {
  return <ToolPage sub="advanced" />;
}
