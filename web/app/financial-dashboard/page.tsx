/* The Dashboard's front page at a public address search engines can read:
   sent whole from the server, unlike /dashboard (account-only, kept out of
   search), which shows the same page only after checking who's signed in.
   Its buttons lead into the Dashboard. */
import { Landing } from "@/components/dashboard/Landing";
import { metadataFor } from "@/lib/seo";

export const metadata = metadataFor("financial-dashboard");

export default function FinancialDashboardPage() {
  return <Landing standalone />;
}
