import { PageShell } from "@/components/shell/PageShell";
import { metadataFor } from "@/lib/seo";
import { Roth } from "@/tools/roth/Roth";

export const metadata = metadataFor("rmd");

export default function Page() {
  return <PageShell slug="rmd"><Roth variant="rmd" /></PageShell>;
}
