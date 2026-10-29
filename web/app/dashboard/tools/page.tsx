/* The Dashboard's Tools: the site's tool list, each tool opening inside
   the Dashboard with what it knows filled in. */
import type { Metadata } from "next";
import { pickerData } from "@/components/tools/picker-data";
import { ToolsListPage } from "@/components/dashboard/ToolsPage";

export const metadata: Metadata = { title: { absolute: "Tools | Your Dashboard | RetCalc" }, robots: { index: false, follow: false } };

export default function Page() {
  return <ToolsListPage data={pickerData()} />;
}
