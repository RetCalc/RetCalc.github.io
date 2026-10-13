"use client";

/* The sign-in dialog: Continue with Google, or an email and then the 6-digit
   code we send to it (no passwords, no phone). After a first sign-in it asks,
   once, what to call you (optional). ACCOUNTS_PLAN.md. */

import { useEffect, useRef, useState } from "react";
import { useAccount } from "./AccountProvider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const GOOGLE = (
  <svg className="acct-g" viewBox="0 0 18 18" aria-hidden="true">
    <path fill="var(--g-blue)" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
    <path fill="var(--g-green)" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
    <path fill="var(--g-yellow)" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
    <path fill="var(--g-red)" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
  </svg>
);

export function SignInDialog() {
  const { step, setStep, configured } = useAccount();
  if (!configured) return null;
  const open = step.at !== "closed";
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) setStep({ at: "closed" }); }}>
      <DialogContent aria-labelledby="acctTitle">
        {step.at === "start" ? <Start /> : step.at === "code" ? <Code email={step.email} /> : step.at === "name" ? <Name /> : null}
      </DialogContent>
    </Dialog>
  );
}

function Start() {
  const { sendCode, signInWithGoogle } = useAccount();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="acct">
      <h2 id="acctTitle">Sign in to RetCalc</h2>
      <p className="acct-lede">Save your household, scenarios and Guide to an account so they follow you to any device. Optional: everything works without one.</p>
      <Button variant="outline" size="lg" className="w-full" onClick={async () => { setErr(null); setBusy(true); const e = await signInWithGoogle(); if (e) { setErr(e); setBusy(false); } }} disabled={busy}>
        {GOOGLE}Continue with Google
      </Button>
      <div className="acct-or" aria-hidden="true"><span>or</span></div>
      <form className="acct-form" onSubmit={async (e) => {
        e.preventDefault();
        if (!email.trim()) return;
        setErr(null); setBusy(true);
        const res = await sendCode(email);
        setBusy(false);
        if (res) setErr(res);
      }}>
        <label htmlFor="acctEmail">Email</label>
        <Input id="acctEmail" type="email" autoComplete="email" inputMode="email" required placeholder="you@example.com"
          value={email} onChange={(e) => setEmail(e.target.value)} />
        <Button type="submit" size="lg" className="w-full" disabled={busy || !email.trim()}>{busy ? "Sending…" : "Send me a code"}</Button>
      </form>
      {err ? <p className="acct-err" role="alert">{err}</p> : null}
      <p className="acct-fine">We email a 6-digit code. No password to remember. Your data is never sold or shared.</p>
    </div>
  );
}

function Code({ email }: { email: string }) {
  const { verifyCode, sendCode, setStep } = useAccount();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [wait, setWait] = useState(60);
  const box = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);
  useEffect(() => { box.current?.focus(); }, []);

  const submit = async (c: string) => {
    if (busy || c.length < 6) return;
    setErr(null); setBusy(true);
    const res = await verifyCode(email, c);
    setBusy(false);
    if (res) { setErr(res); setCode(""); box.current?.focus(); }
  };

  return (
    <div className="acct">
      <h2 id="acctTitle">Check your email</h2>
      <p className="acct-lede">We sent a 6-digit code to <b>{email}</b>. It works for one hour.</p>
      <form className="acct-form" onSubmit={(e) => { e.preventDefault(); void submit(code); }}>
        <label htmlFor="acctCode">Code</label>
        <Input ref={box} id="acctCode" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={8}
          value={code} onChange={(e) => {
            const c = e.target.value.replace(/\D/g, "").slice(0, 8);
            setCode(c);
            if (c.length === 6) void submit(c);
          }} />
        <Button type="submit" size="lg" className="w-full" disabled={busy || code.length < 6}>{busy ? "Checking…" : "Sign in"}</Button>
      </form>
      {err ? <p className="acct-err" role="alert">{err}</p> : null}
      <div className="acct-links">
        <Button variant="link" size="inline" disabled={wait > 0} onClick={async () => {
          setErr(null);
          const res = await sendCode(email);
          if (res) setErr(res); else setWait(60);
        }}>{wait > 0 ? `Send a new code in ${wait}s` : "Send a new code"}</Button>
        <Button variant="link" size="inline" onClick={() => setStep({ at: "start" })}>Use a different email</Button>
      </div>
      <p className="acct-fine">Not there? Check spam, or wait a minute; it comes from signin@retcalc.app.</p>
    </div>
  );
}

function Name() {
  const { account, setFirstName } = useAccount();
  const [name, setName] = useState(account?.suggestedName ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const done = async (n: string | null) => {
    setBusy(true);
    const res = await setFirstName(n);
    setBusy(false);
    if (res) setErr(res);
  };
  return (
    <div className="acct">
      <h2 id="acctTitle">You&apos;re signed in</h2>
      <p className="acct-lede">What should we call you? Optional, and only used to greet you here.</p>
      <form className="acct-form" onSubmit={(e) => { e.preventDefault(); void done(name || null); }}>
        <label htmlFor="acctName">First name</label>
        <Input id="acctName" autoComplete="given-name" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <div className="acct-row">
          <Button type="button" variant="outline" size="lg" disabled={busy} onClick={() => void done(null)}>Skip</Button>
          <Button type="submit" size="lg" disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
        </div>
      </form>
      {err ? <p className="acct-err" role="alert">{err}</p> : null}
    </div>
  );
}
