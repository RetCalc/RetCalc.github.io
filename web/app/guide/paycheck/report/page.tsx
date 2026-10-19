/* Paycheck to Retirement's report: the walkthrough as printable pages, in
   the Guide report's system and face. Kept out of search: there's nothing
   on it until the walkthrough is done. */
import type { Metadata } from "next";
import { Public_Sans } from "next/font/google";
import { PlanReport } from "@/tools/plan/report/Report";

const publicSans = Public_Sans({ subsets: ["latin"], display: "swap", variable: "--rp-font-face" });

export const metadata: Metadata = {
  title: "Your paycheck plan · RetCalc",
  description: "Your Paycheck to Retirement walkthrough as a full printable report.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <PlanReport fontClass={publicSans.variable} />;
}
