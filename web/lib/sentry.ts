/* Sentry error reporting, shared by the browser (instrumentation-client.ts)
   and the server (instrumentation.ts). Errors only: no tracing, no session
   replay, no personal data. Only the production deployment (retcalc.app)
   reports; previews, local builds and the e2e checks never do.

   A shared link carries a tool's figures in its hash, and a few pages read
   the query, so every address Sentry would keep is cut back to its path
   before anything leaves the page. Console messages are left out too, since
   they can print figures. */
import type { Breadcrumb, ErrorEvent, init } from "@sentry/nextjs";

/** Where errors go. A DSN only lets a page send errors in, so it's safe in
    the bundle; reading them needs a Sentry sign-in. */
const DSN = "https://6d247112c0072291184d76a0b325a7a2@o4512294971965440.ingest.us.sentry.io/4512294991233024";

/** Set from VERCEL_ENV at build time in next.config.ts. */
const ENVIRONMENT = process.env.SENTRY_ENVIRONMENT || "development";

/** An address without its query or hash. */
function bare(url: string): string {
  const cut = url.search(/[?#]/);
  return cut < 0 ? url : url.slice(0, cut);
}

function scrubEvent(event: ErrorEvent): ErrorEvent {
  if (event.request?.url) event.request.url = bare(event.request.url);
  delete event.user;
  return event;
}

function scrubBreadcrumb(crumb: Breadcrumb): Breadcrumb | null {
  if (crumb.category === "console") return null;
  if (crumb.data) {
    const data = { ...crumb.data };
    for (const key of ["url", "from", "to"]) {
      if (typeof data[key] === "string") data[key] = bare(data[key]);
    }
    crumb.data = data;
  }
  return crumb;
}

export const SENTRY_OPTIONS: Parameters<typeof init>[0] = {
  dsn: DSN,
  environment: ENVIRONMENT,
  enabled: ENVIRONMENT === "production",
  // Sentry collects all of these unless told not to. Local variables would
  // carry the figures a tool was working with when it failed.
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: false,
    httpBodies: [],
    urlQueryParams: false,
    stackFrameVariables: false,
  },
  tracesSampleRate: 0,
  beforeSend: scrubEvent,
  beforeBreadcrumb: scrubBreadcrumb,
};
