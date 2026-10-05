import { PageShell } from "@/components/shell/PageShell";
import { metadataFor } from "@/lib/seo";
import { Drawdown } from "@/tools/drawdown/Drawdown";

export const metadata = metadataFor("cape-withdrawal");

export default function Page() {
  return <PageShell slug="cape-withdrawal"><Drawdown landing="cape-withdrawal" /></PageShell>;
}
