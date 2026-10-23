/* One tool, inside the Dashboard. */
import type { Metadata } from "next";
import { TOOLS, type ToolSub } from "@/lib/tools";
import { ToolPage } from "@/components/dashboard/ToolsPage";

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(TOOLS).map((tool) => ({ tool }));
}

export async function generateMetadata({ params }: PageProps<"/dashboard/tools/[tool]">): Promise<Metadata> {
  const { tool } = await params;
  return { title: { absolute: `${TOOLS[tool as ToolSub].name} | Your dashboard | RetCalc` }, robots: { index: false, follow: false } };
}

export default async function Page({ params }: PageProps<"/dashboard/tools/[tool]">) {
  const { tool } = await params;
  return <ToolPage sub={tool as ToolSub} />;
}
