/* Starts Sentry on the server (Node and edge) and reports errors thrown
   while a request is handled. The settings are in lib/sentry.ts. */
import * as Sentry from "@sentry/nextjs";
import { SENTRY_OPTIONS } from "@/lib/sentry";

export function register() {
  Sentry.init(SENTRY_OPTIONS);
}

export const onRequestError = Sentry.captureRequestError;
