/* The Basic calculator, inside the Dashboard: filled in from your plan,
   nothing it does reaching the plan. Advanced is a switch away. */
import type { Metadata } from "next";
import { ToolPage } from "@/components/dashboard/ToolsPage";

export const metadata: Metadata = { title: { absolute: "Basic Calculator | Your Dashboard | RetCalc" }, robots: { index: false, follow: false } };

export default function Page() {
  return <ToolPage sub="basic" />;
}
