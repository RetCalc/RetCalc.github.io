/* Every Dashboard address shares one link-preview card and description
   (lib/cards.ts "dashboard", saved as public/og/dashboard.jpg), so a link
   to any of its pages shows what the Dashboard is. Pages keep their own
   tab titles. */
import type { Metadata } from "next";
import { CARDS, cardAlt } from "@/lib/cards";
import { SITE } from "@/lib/site";

const card = CARDS.dashboard!;
const title = "Financial Dashboard | RetCalc";
const url = `${SITE}/dashboard`;
const image = { url: `${SITE}/og/dashboard.jpg`, width: 1200, height: 630, alt: cardAlt(card) };

export const metadata: Metadata = {
  description: card.text,
  openGraph: { type: "website", siteName: "RetCalc", title, description: card.text, url, images: [image] },
  twitter: { card: "summary_large_image", title, description: card.text, images: [image.url] },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
