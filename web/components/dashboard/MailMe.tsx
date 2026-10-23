"use client";

/* An email address put together in the browser, so it isn't sitting in the
   page for address-harvesting bots: the server (and a bot reading its HTML)
   gets "user [at] domain" and no mailto link; once the page is running in
   a browser it becomes the real address. Used by the About pages. */

import { useSyncExternalStore } from "react";

const noSubscribe = () => () => {};

export function MailMe({ user, domain }: { user: string; domain: string }) {
  const inBrowser = useSyncExternalStore(noSubscribe, () => true, () => false);
  const addr = inBrowser ? user + "@" + domain : null;
  return <a className="mailme" href={addr ? "mailto:" + addr : "#"}>{addr ?? user + " [at] " + domain}</a>;
}
