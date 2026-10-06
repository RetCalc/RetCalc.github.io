import { PageShell } from "@/components/shell/PageShell";
import { metadataFor } from "@/lib/seo";
import { STATE_OPTIONS } from "@/lib/states";
import { About } from "@/tools/about/About";

export const metadata = metadataFor("about");

export default function Page() {
  return <PageShell slug="about"><About states={STATE_OPTIONS} /></PageShell>;
}
