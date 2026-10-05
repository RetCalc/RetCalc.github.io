/* Compare: saved retirement scenarios side by side. It had no address of
   its own on the old site (it opened from the Save menu), so it stays out
   of search results and the sitemap. */
import type { Metadata } from "next";
import { HouseholdBar } from "@/components/household/HouseholdBar";
import { STATE_OPTIONS } from "@/lib/states";
import { Compare } from "@/tools/compare/Compare";

export const metadata: Metadata = {
  title: { absolute: "Compare scenarios | RetCalc" },
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <>
      <h1 className="srlive" id="pageH1">Compare scenarios</h1>
      <HouseholdBar states={STATE_OPTIONS} />
      <Compare />
    </>
  );
}
