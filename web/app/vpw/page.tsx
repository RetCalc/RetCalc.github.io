import { PageShell } from "@/components/shell/PageShell";
import { metadataFor } from "@/lib/seo";
import { Drawdown } from "@/tools/drawdown/Drawdown";

export const metadata = metadataFor("vpw");

export default function Page() {
  return <PageShell slug="vpw"><Drawdown landing="vpw" /></PageShell>;
}
