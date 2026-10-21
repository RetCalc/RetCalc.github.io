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
          <div className="mt-5 flex flex-wrap gap-2.5">
            <button type="button" onClick={() => retry()} className={buttonVariants({ variant: "default" })}>Try again</button>
            <Link href="/" className={buttonVariants({ variant: "secondary" })}>Go to the homepage</Link>
          </div>
        </div>
      </body>
    </html>
  );
}
