"use client";

import Link from "next/link";
import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { buttonVariants } from "@/components/ui/button";
import "./globals.css";

/* Shown in place of the whole site when a page crashes while drawing, and
   the one place those errors reach Sentry (an error thrown outside drawing
   is caught by Sentry on its own). It replaces the root layout, so it brings
   its own document and styles. */

/* Starting fresh: the inputs this tab keeps for each tool (session storage,
   ToolState.tsx) and the share link in the address are what a reload would
   bring back, so a crash they caused would come straight back with them.
   The household and saved scenarios stay. */
function startFresh() {
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const k = sessionStorage.key(i);
      if (k?.startsWith("retcalc.tool-")) sessionStorage.removeItem(k);
    }
  } catch { /* storage blocked: nothing was kept */ }
  window.location.replace(window.location.pathname);
}
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <title>Something went wrong · RetCalc</title>
        <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:py-20">
          <h1 className="toolhead-name">Something went wrong</h1>
          <p className="mt-2 mb-0 text-body text-muted-foreground">The page hit an error and couldn&apos;t finish. It has been reported, and trying again usually works.</p>
          <p className="mt-2 mb-0 text-body text-muted-foreground">If it happens again, start the page fresh. That clears the numbers typed into the tools in this tab. Your household and saved scenarios stay.</p>
          <div className="mt-5 flex flex-wrap gap-2.5">
            <button type="button" onClick={() => retry()} className={buttonVariants({ variant: "default" })}>Try again</button>
            <button type="button" onClick={startFresh} className={buttonVariants({ variant: "secondary" })}>Start the page fresh</button>
            <Link href="/" className={buttonVariants({ variant: "secondary" })}>Go to the homepage</Link>
          </div>
        </div>
      </body>
    </html>
  );
}
