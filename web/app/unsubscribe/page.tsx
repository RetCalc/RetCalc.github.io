/* The check-in email's unsubscribe link lands here (supabase/CHECKIN_EMAIL.md).
   Kept out of search results and the sitemap. */
import type { Metadata } from "next";
import { Unsubscribe } from "@/components/account/Unsubscribe";

export const metadata: Metadata = {
  title: { absolute: "Check-in email | RetCalc" },
  robots: { index: false, follow: false },
  // The link carries a token: don't pass the address on to other sites.
  referrer: "no-referrer",
};

export default function Page() {
  return (
    <>
      <h1 className="srlive" id="pageH1">Check-in email</h1>
      <Unsubscribe />
    </>
  );
}
