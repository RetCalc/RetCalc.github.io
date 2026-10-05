import { PageShell } from "@/components/shell/PageShell";
import { metadataFor } from "@/lib/seo";
import { Tax } from "@/tools/tax/Tax";

export const metadata = metadataFor("incometax");

export default function Page() {
  return <PageShell slug="incometax"><Tax /></PageShell>;
}
