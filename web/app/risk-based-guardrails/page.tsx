import { PageShell } from "@/components/shell/PageShell";
import { metadataFor } from "@/lib/seo";
import { Drawdown } from "@/tools/drawdown/Drawdown";

export const metadata = metadataFor("risk-based-guardrails");

export default function Page() {
  return <PageShell slug="risk-based-guardrails"><Drawdown landing="risk-based-guardrails" /></PageShell>;
}
