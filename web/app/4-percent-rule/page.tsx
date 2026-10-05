import { PageShell } from "@/components/shell/PageShell";
import { metadataFor } from "@/lib/seo";
import { Drawdown } from "@/tools/drawdown/Drawdown";

export const metadata = metadataFor("4-percent-rule");

export default function Page() {
  return <PageShell slug="4-percent-rule"><Drawdown landing="4-percent-rule" /></PageShell>;
}
