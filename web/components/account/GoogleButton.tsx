"use client";

/* "Continue with Google" with Google's own button (Google Identity
   Services), so Google's sign-in says it's for retcalc.app rather than the
   Supabase project's address. Google returns a signed token to this page and
   Supabase checks it (signInWithIdToken), with a one-time nonce: the hashed
   nonce goes to Google, which puts it in the token, and the raw one to
   Supabase, which checks they match, so a token can't be replayed.

   Google's script loads only when the sign-in dialog opens, never on an
   ordinary page view. If it can't load (blocked, offline) or no client ID is
   set, the button falls back to the redirect sign-in. ACCOUNTS_PLAN.md. */

import { useEffect, useRef, useState } from "react";
import { useAccount } from "./AccountProvider";
import { useTheme } from "@/lib/theme";
import { settle } from "@/lib/sync/account";
import { Button } from "@/components/ui/button";

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const SCRIPT = "https://accounts.google.com/gsi/client";

interface Gsi {
  initialize(o: Record<string, unknown>): void;
  renderButton(el: HTMLElement, o: Record<string, unknown>): void;
}
declare global {
  interface Window { google?: { accounts?: { id?: Gsi } } }
}

let loading: Promise<Gsi> | null = null;
function loadGsi(): Promise<Gsi> {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id);
  loading ??= new Promise<Gsi>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT;
    s.async = true;
    s.onload = () => (window.google?.accounts?.id ? resolve(window.google.accounts.id) : reject(new Error("no gsi")));
    s.onerror = () => { loading = null; reject(new Error("gsi blocked")); };
    document.head.appendChild(s);
    setTimeout(() => reject(new Error("gsi timeout")), 6000);
  });
  return loading;
}

/** A raw nonce for Supabase and its SHA-256 (hex) for Google. */
async function makeNonce(): Promise<[raw: string, hashed: string]> {
  const raw = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return [raw, Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("")];
}

export function GoogleButton({ fallbackIcon, onError }: { fallbackIcon: React.ReactNode; onError: (msg: string | null) => void }) {
  const { client, signInWithGoogle, setStep } = useAccount();
  const theme = useTheme();
  const slot = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"loading" | "google" | "fallback">(CLIENT_ID ? "loading" : "fallback");
  const latestError = useRef(onError);
  useEffect(() => { latestError.current = onError; });

  useEffect(() => {
    if (!CLIENT_ID || !client) return;
    let live = true;
    (async () => {
      try {
        const [gsi, [raw, hashed]] = await Promise.all([loadGsi(), makeNonce()]);
        if (!live || !slot.current) return;
        gsi.initialize({
          client_id: CLIENT_ID,
          nonce: hashed,
          context: "signin",
          ux_mode: "popup",
          use_fedcm_for_prompt: true,
          callback: async (r: { credential?: string }) => {
            if (!r.credential) return;
            const { error } = await settle(client.auth.signInWithIdToken({ provider: "google", token: r.credential, nonce: raw }));
            if (error) latestError.current("Google sign-in didn't go through. Try again, or use your email.");
            else setStep({ at: "closed" });
          },
        });
        gsi.renderButton(slot.current, {
          type: "standard", size: "large", text: "continue_with", shape: "rectangular", logo_alignment: "center",
          theme: theme === "dark" ? "filled_black" : "outline", width: Math.min(400, slot.current.clientWidth || 292),
        });
        setMode("google");
      } catch {
        if (live) setMode("fallback");
      }
    })();
    return () => { live = false; };
  }, [client, theme, setStep]);

  if (mode === "fallback") {
    return (
      <Button variant="outline" size="lg" className="w-full" onClick={async () => { onError(null); const e = await signInWithGoogle(); if (e) onError(e); }}>
        {fallbackIcon}Continue with Google
      </Button>
    );
  }
  return <div className="acct-gsi" ref={slot} data-mode={mode} aria-busy={mode === "loading"} />;
}
