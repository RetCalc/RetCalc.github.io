import { PageShell } from "@/components/shell/PageShell";
import { metadataFor } from "@/lib/seo";
import { Backtest } from "@/tools/backtest/Backtest";

export const metadata = metadataFor("backtest");

export default function Page() {
  return <PageShell slug="backtest"><Backtest /></PageShell>;
}
