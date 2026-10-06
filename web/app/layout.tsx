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
import { ToolHelp } from "@/tools/help/ToolHelp";
import { SITE } from "@/lib/site";
import { THEME_SCRIPT } from "@/lib/theme-script";

import "./globals.css";
import { PaneMotion } from "@/components/shell/PaneMotion";
import Script from "next/script";
import { IBM_Plex_Sans } from "next/font/google";

/* The site's one typeface, served from this site (next/font downloads it at
   build time, so visitors never contact Google) with a metric-matched
   fallback while it loads. Exposed as --font-plex-sans for styles/00-base.css. */
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-plex-sans",
});

/** The production deployment, the one retcalc.app serves. */
const LIVE = process.env.VERCEL_ENV === "production";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: "RetCalc",
  /* Only the production deployment (retcalc.app) is in search results;
     previews and local builds stay out, so Google never sees two copies. */
  robots: LIVE ? undefined : { index: false, follow: false },
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
    <html lang="en" className={plexSans.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
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
            <PaneMotion />
            <Footer />
            <Tooltips />
            <SelectMenus />
            <PageEffects />
            <GuideCoach />
            <ToolHelp />
            <SheetHost />
            {/* Cloudflare Web Analytics, the current site's token; it follows
                page changes on its own. Production only, so previews aren't
                counted as visits. */}
            {LIVE ? (
              <Script src="https://static.cloudflareinsights.com/beacon.min.js" strategy="afterInteractive"
                data-cf-beacon='{"token": "43d7ad6321b545f2bb8d2e02569490ee"}' />
            ) : null}
          </HouseholdProvider>
          </ToolRegistryProvider>
          </PopupProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
