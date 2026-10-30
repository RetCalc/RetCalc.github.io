/* The Dashboard's printed report: the household's whole plan as US Letter
   pages, built in the browser from the Dashboard, to read on screen and
   print or save as a PDF. Kept out of search, like the rest of the
   Dashboard. */
import type { Metadata } from "next";
import { Public_Sans } from "next/font/google";
import { DashboardReport } from "@/components/dashboard/report/Report";

/* The report's own face, as the Guide's report has it, only on this page. */
const publicSans = Public_Sans({ subsets: ["latin"], display: "swap", variable: "--rp-font-face" });

export const metadata: Metadata = {
  title: { absolute: "Your financial plan report | Your Dashboard | RetCalc" },
  description: "Your Dashboard's whole plan as a printable report.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <DashboardReport fontClass={publicSans.variable} />;
}
