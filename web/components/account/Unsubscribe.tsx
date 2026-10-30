"use client";

/* Where the check-in email's "Turn off this email" link lands
   (retcalc.app/unsubscribe?t=<token>): one button switches the email off,
   sending the signed token to the checkin-email function. It waits for the
   press, so a mail scanner that opens links can't turn it off by itself. No
   sign-in needed; the token names whose email it is. Mail apps' own
   unsubscribe button goes to the function directly. supabase/CHECKIN_EMAIL.md. */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;

type At = "ask" | "working" | "off" | "bad" | "failed" | "unavailable";

export function Unsubscribe() {
  const [at, setAt] = useState<At>("ask");
  const [token, setToken] = useState<string | null>(null);

  const send = useCallback(async (t: string) => {
    setAt("working");
    try {
      const r = await fetch(BASE + "/functions/v1/checkin-email/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: t }),
      });
      if (r.ok) {
        setAt("off");
        // The token isn't needed any more: keep it out of the browser's history.
        window.history.replaceState(null, "", window.location.pathname);
      } else setAt(r.status === 400 ? "bad" : "failed");
    } catch {
      setAt("failed");
    }
  }, []);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("t");
    /* eslint-disable react-hooks/set-state-in-effect -- the token is in the address, read once the page is in a browser */
    if (!BASE) { setAt("unavailable"); return; }
    if (!t) { setAt("bad"); return; }
    setToken(t);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const profile = <Button nativeButton={false} render={<Link href="/dashboard/profile#checkin" />}>Open Profile</Button>;
  const card = (title: string, desc: React.ReactNode, action?: React.ReactNode) => (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle><CardDescription>{desc}</CardDescription></CardHeader>
      {action ? <CardContent>{action}</CardContent> : null}
    </Card>
  );

  return (
    <div className="acct-page" role="status" aria-live="polite">
      {at === "ask" ? card("Turn off the check-in email?", "You won't get the monthly reminder to update your balances. You can turn it back on any time in Profile on your Dashboard.",
          <Button onClick={() => token && void send(token)} disabled={!token}>Turn it off</Button>)
        : at === "working" ? card("Turning off the check-in email…", "One moment.")
        : at === "off" ? card("The check-in email is off", "You won't get the monthly check-in email any more. To turn it back on, use Profile on your Dashboard.", profile)
        : at === "bad" ? card("This link didn't work", "It may have been cut short when it was copied. You can turn the email off from Profile on your Dashboard instead.", profile)
        : at === "failed" ? card("Couldn't turn it off just now", "Check your connection, then try again.", token ? <Button onClick={() => void send(token)}>Try again</Button> : null)
        : card("Not available here", "This copy of RetCalc doesn't send email.")}
    </div>
  );
}
