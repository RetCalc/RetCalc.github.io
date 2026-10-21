import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  env: {
    // Which deployment this build is, for lib/sentry.ts: only "production"
    // (retcalc.app) reports errors.
    SENTRY_ENVIRONMENT: process.env.VERCEL_ENV ?? "development",
  },
  async redirects() {
    return [
      // The old site served each page as a file too (/drawdown.html), and
      // the Calculator modes were once called Single and Series.
      { source: "/index.html", destination: "/", permanent: true },
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
