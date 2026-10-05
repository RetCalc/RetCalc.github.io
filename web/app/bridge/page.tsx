import { PageShell } from "@/components/shell/PageShell";
import { metadataFor } from "@/lib/seo";
import { Bridge } from "@/tools/bridge/Bridge";

export const metadata = metadataFor("bridge");

export default function Page() {
  return <PageShell slug="bridge"><Bridge /></PageShell>;
}
