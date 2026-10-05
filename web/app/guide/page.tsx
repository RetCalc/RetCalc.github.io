import { PageShell } from "@/components/shell/PageShell";
import { metadataFor } from "@/lib/seo";
import { Guide } from "@/tools/guide/Guide";

export const metadata = metadataFor("guide");

export default function Page() {
  return <PageShell slug="guide"><Guide /></PageShell>;
}
