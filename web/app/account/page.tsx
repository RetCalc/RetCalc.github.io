/* Your account (optional): name, what's synced, download, delete.
   ACCOUNTS_PLAN.md. Kept out of search results and the sitemap. */
import type { Metadata } from "next";
import { AccountPage } from "@/components/account/AccountPage";
import { STATE_OPTIONS } from "@/lib/states";

export const metadata: Metadata = {
  title: { absolute: "Your account | RetCalc" },
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <>
      <h1 className="srlive" id="pageH1">Your account</h1>
      <AccountPage states={STATE_OPTIONS} />
    </>
  );
}
