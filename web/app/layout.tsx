import type { Metadata, Viewport } from "next";

/* Today's styles, unchanged from src/css/ and loaded in the same order (later
   files win ties). They stay as they are until the site has switched over;
   the redesign comes after. */
import "@/styles/00-base.css";
import "@/styles/01-masthead-layout.css";
import "@/styles/02-fields-readout.css";
import "@/styles/03-navigation.css";
import "@/styles/04-tool-icons-header.css";
import "@/styles/05-household-accounts-stages.css";
import "@/styles/06-data-controls.css";
import "@/styles/07-print-sheet.css";
import "@/styles/08-about-budget.css";
import "@/styles/09-popups-tooltips.css";
import "@/styles/10-tools.css";
import "@/styles/11-charts.css";
import "@/styles/12-guide.css";
import "@/styles/13-chart-ink-logo.css";
import "@/styles/14-footer-menus-mobile.css";
import "@/styles/15-optimizer.css";

export const metadata: Metadata = {
  title: "RetCalc",
  /* Kept out of search results until it replaces the live site, so Google
     never sees two copies of RetCalc. Removed at the switch (MIGRATION.md,
     phase 6). */
  robots: { index: false, follow: false },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "16x16 32x32 48x48" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
  appleWebApp: { capable: true, title: "RetCalc", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "dark light",
  themeColor: "#080b16",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <head>
        {/* The same Google Fonts request as the current site, so text renders
            identically; moves to next/font in phase 2. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Instrument+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
