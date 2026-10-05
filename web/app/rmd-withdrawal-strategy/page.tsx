import { PageShell } from "@/components/shell/PageShell";
import { metadataFor } from "@/lib/seo";
import { Drawdown } from "@/tools/drawdown/Drawdown";

export const metadata = metadataFor("rmd-withdrawal-strategy");

export default function Page() {
  return <PageShell slug="rmd-withdrawal-strategy"><Drawdown landing="rmd-withdrawal-strategy" /></PageShell>;
}
