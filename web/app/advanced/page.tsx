import { PageShell } from "@/components/shell/PageShell";
import { metadataFor } from "@/lib/seo";
import { Advanced } from "@/tools/advanced/Advanced";

export const metadata = metadataFor("advanced");

export default function Page() {
  return <PageShell slug="advanced"><Advanced /></PageShell>;
}
