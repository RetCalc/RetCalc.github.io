/* The Retirement Readiness Guide, at its own address since the Guide tab
   became a landing page for both walkthroughs (/guide). */
import { PageShell } from "@/components/shell/PageShell";
import { metadataFor } from "@/lib/seo";
import { Guide } from "@/tools/guide/Guide";

export const metadata = metadataFor("guide/readiness");

export default function Page() {
  return <PageShell slug="guide/readiness"><Guide /></PageShell>;
}
