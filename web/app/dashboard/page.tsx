/* The Dashboard: an account-only home for the whole financial picture,
   kept apart from the rest of the site while it's worked out. Kept out of
   search results and the sitemap. */
import type { Metadata } from "next";
import { OverviewPage } from "@/components/dashboard/Pages";

export const metadata: Metadata = {
  title: { absolute: "Your Dashboard | RetCalc" },
  robots: { index: false, follow: false },
};

export default function Page() {
  return <OverviewPage />;
}
