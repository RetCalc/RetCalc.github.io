import { PageShell } from "@/components/shell/PageShell";
import { metadataFor } from "@/lib/seo";
import { Mortgage } from "@/tools/mortgage/Mortgage";

export const metadata = metadataFor("mortgage");

export default function Page() {
  return <PageShell slug="mortgage"><Mortgage /></PageShell>;
}
