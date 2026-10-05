import { PageShell } from "@/components/shell/PageShell";
import { metadataFor } from "@/lib/seo";
import { Drawdown } from "@/tools/drawdown/Drawdown";

export const metadata = metadataFor("guardrails");

export default function Page() {
  return <PageShell slug="guardrails"><Drawdown landing="guardrails" /></PageShell>;
}
