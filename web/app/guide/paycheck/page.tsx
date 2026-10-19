/* Paycheck to Retirement (PAYCHECK_PLAN_BRIEF.md): the Guide's second way
   in, straight to the numbers. Kept out of search while it's reviewed. */
import type { Metadata } from "next";
import { Walkthrough } from "@/tools/plan/Walkthrough";

export const metadata: Metadata = {
  title: "Paycheck to Retirement · RetCalc",
  description: "From gross pay to a retirement plan: your taxes, your budget, where each paycheck goes, and where that gets you.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <Walkthrough />;
}
