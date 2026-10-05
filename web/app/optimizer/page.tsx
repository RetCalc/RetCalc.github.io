import { PageShell } from "@/components/shell/PageShell";
import { metadataFor } from "@/lib/seo";
import { Optimizer } from "@/tools/optimizer/Optimizer";

export const metadata = metadataFor("optimizer");

export default function Page() {
  return <PageShell slug="optimizer"><Optimizer /></PageShell>;
}
