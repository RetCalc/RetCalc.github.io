/* Setting up the Dashboard, full screen. */
import type { Metadata } from "next";
import { SetupPage } from "@/components/dashboard/Pages";

export const metadata: Metadata = {
  title: { absolute: "Set up your dashboard | RetCalc" },
  robots: { index: false, follow: false },
};

export default function Page() {
  return <SetupPage />;
}
