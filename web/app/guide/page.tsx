/* The Guide tab: a landing page for its two walkthroughs, the Retirement
   Readiness Guide (/guide/readiness) and Paycheck to Retirement
   (/guide/paycheck). */
import { PageShell } from "@/components/shell/PageShell";
import { metadataFor } from "@/lib/seo";
import { GuideLanding } from "@/tools/guide/Landing";

export const metadata = metadataFor("guide");

export default function Page() {
  return <PageShell slug="guide"><GuideLanding /></PageShell>;
}
