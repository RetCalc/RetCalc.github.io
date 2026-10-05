import { PageShell } from "@/components/shell/PageShell";
import { metadataFor } from "@/lib/seo";
import { Drawdown } from "@/tools/drawdown/Drawdown";

export const metadata = metadataFor("vanguard-dynamic-spending");

export default function Page() {
  return <PageShell slug="vanguard-dynamic-spending"><Drawdown landing="vanguard-dynamic-spending" /></PageShell>;
}
