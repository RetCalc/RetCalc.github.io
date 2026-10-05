import { PageShell } from "@/components/shell/PageShell";
import { metadataFor } from "@/lib/seo";
import { Healthcare } from "@/tools/healthcare/Healthcare";

export const metadata = metadataFor("healthcare");

export default function Page() {
  return <PageShell slug="healthcare"><Healthcare /></PageShell>;
}
