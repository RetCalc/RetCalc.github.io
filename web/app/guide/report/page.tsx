/* The Guide's full report (REPORT_BRIEF.md): every page of the plan, built
   in the browser from the Guide's answers, to read on screen and print or
   save as a PDF. Kept out of search: there's nothing on it until a visitor
   has answered the Guide. */
import type { Metadata } from "next";
import { Public_Sans } from "next/font/google";
import { Report } from "@/tools/guide/report/Report";

/* The report's own face (direction C, .impeccable/surfaces/guide-report.md),
   served from this site like the site's own, and only on this page. */
const publicSans = Public_Sans({ subsets: ["latin"], display: "swap", variable: "--rp-font-face" });

export const metadata: Metadata = {
  title: "Your retirement report · RetCalc",
  description: "Your Retirement Readiness Guide plan as a full printable report.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <Report fontClass={publicSans.variable} />;
}
