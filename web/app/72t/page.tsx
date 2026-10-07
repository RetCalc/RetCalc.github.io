import { PageShell } from "@/components/shell/PageShell";
import { metadataFor } from "@/lib/seo";
import { Bridge } from "@/tools/bridge/Bridge";

export const metadata = metadataFor("72t");

export default function Page() {
  return <PageShell slug="72t"><Bridge variant="72t" /></PageShell>;
}
