/* Paycheck to Retirement (PAYCHECK_PLAN_BRIEF.md): the Guide's second way
   in, straight to the numbers. Its title and description are in
   lib/page-meta.json, and it's in the sitemap. */
import { metadataFor } from "@/lib/seo";
import { Walkthrough } from "@/tools/plan/Walkthrough";

export const metadata = metadataFor("guide/paycheck");

export default function Page() {
  return <Walkthrough />;
}
