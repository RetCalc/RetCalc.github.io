import type { Metadata, Viewport } from "next";
import { HouseholdProvider } from "@/components/household/HouseholdProvider";
import { Footer } from "@/components/shell/Footer";
import { Main } from "@/components/shell/Main";
import { Masthead } from "@/components/shell/Masthead";
import { NavBar } from "@/components/shell/NavBar";
import { PageEffects } from "@/components/shell/PageEffects";
import { SheetHost } from "@/components/shell/Sheet";
import { PopupProvider } from "@/components/shell/Popup";
import { SelectMenus } from "@/components/shell/SelectMenus";
import { ToastProvider } from "@/components/shell/Toast";
import { Tooltips } from "@/components/shell/Tooltips";
import { ToolRegistryProvider } from "@/components/tools/ToolState";
import { GuideCoach } from "@/tools/guide/Coach";
import { SITE } from "@/lib/site";
import { THEME_SCRIPT } from "@/lib/theme-script";

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
  metadataBase: new URL(SITE),
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
    // The theme script sets data-theme before React loads, so the server's
    // <html> and the browser's differ by that one attribute, on purpose.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        {/* The same Google Fonts request as the current site, so text renders
            identically. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Instrument+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap"
        />
      </head>
      <body>
        <ToastProvider>
          <PopupProvider>
          <ToolRegistryProvider>
          <HouseholdProvider>
            <Masthead />
            <NavBar />
            <div id="srLive" className="srlive" aria-live="polite" aria-atomic="true"></div>
            <Main>{children}</Main>
            <Footer />
            <Tooltips />
            <SelectMenus />
            <PageEffects />
            <GuideCoach />
            <SheetHost />
          </HouseholdProvider>
          </ToolRegistryProvider>
          </PopupProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
