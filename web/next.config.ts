import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  env: {
    // Which deployment this build is, for lib/sentry.ts: only "production"
    // (retcalc.app) reports errors.
    SENTRY_ENVIRONMENT: process.env.VERCEL_ENV ?? "development",
  },
  compiler: {
    // Sentry reports errors only (lib/sentry.ts), so its performance
    // tracing and debug logging are left out of the build: about a quarter
    // of its weight, on every page. These are Sentry's own switches, which
    // its plugin sets only under webpack.
    define: { __SENTRY_TRACING__: false, __SENTRY_DEBUG__: false },
  },
  async redirects() {
    return [
      // The old site served each page as a file too (/drawdown.html), and
      // the Calculator modes were once called Single and Series.
      { source: "/index.html", destination: "/", permanent: true },
      // The Dashboard's Taxes tab became part of Taxes & Savings.
      { source: "/dashboard/taxes", destination: "/dashboard/savings", permanent: true },
      { source: "/single", destination: "/advanced", permanent: true },
      { source: "/series", destination: "/stages", permanent: true },
      { source: "/single.html", destination: "/advanced", permanent: true },
      { source: "/series.html", destination: "/stages", permanent: true },
      { source: "/:slug.html", destination: "/:slug", permanent: true },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: "retcalc",
  project: "retcalc-web",
  // Errors go to retcalc.app/monitoring and on to Sentry from there, so
  // ad blockers that stop sentry.io don't drop them.
  tunnelRoute: "/monitoring",
  // Readable stack traces need the source maps sent to Sentry, which needs
  // SENTRY_AUTH_TOKEN. Without it no maps are made, so none are served.
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  telemetry: false,
  silent: !process.env.CI,
  suppressOnRouterTransitionStartWarning: true,
});
