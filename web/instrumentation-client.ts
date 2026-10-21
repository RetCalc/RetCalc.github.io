/* Starts Sentry in the browser before the page becomes interactive. The
   settings, and what they leave out, are in lib/sentry.ts. */
import * as Sentry from "@sentry/nextjs";
import { SENTRY_OPTIONS } from "@/lib/sentry";

Sentry.init(SENTRY_OPTIONS);
