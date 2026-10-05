import { PageShell } from "@/components/shell/PageShell";
import { metadataFor } from "@/lib/seo";
import { Drawdown } from "@/tools/drawdown/Drawdown";

export const metadata = metadataFor("ratcheting-withdrawal");

export default function Page() {
  return <PageShell slug="ratcheting-withdrawal"><Drawdown landing="ratcheting-withdrawal" /></PageShell>;
}
