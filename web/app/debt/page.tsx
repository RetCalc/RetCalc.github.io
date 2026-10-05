import { PageShell } from "@/components/shell/PageShell";
import { metadataFor } from "@/lib/seo";
import { Debt } from "@/tools/debt/Debt";

export const metadata = metadataFor("debt");

export default function Page() {
  return <PageShell slug="debt"><Debt /></PageShell>;
}
