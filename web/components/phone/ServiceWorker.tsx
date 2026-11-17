"use client";

/* Registers the service worker (public/sw.js, built from
   scripts/sw/sw.template.js, which says what it does and never does), on
   production builds only: a dev server's pages change under it.

   - Each time the page comes back into view the browser re-checks the
     worker's file, so an installed app left open still picks up a deploy.
   - In the home-screen app, once things are quiet, it asks the worker to
     save every calculator ahead of time ("warm"), and loads the few parts
     a calculator fetches on demand (the tips' text, a tool's Help, the
     Guide's coach) so they're saved too. Not on a data-saver connection.
   - Signed in at launch, the home-screen app on a phone opens on the
     Dashboard instead of the homepage.
   - The browser's bars follow a theme chosen by hand. */

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { isSessionKey } from "@/lib/sync/account";
import { readThemeChoice, resolveTheme, syncThemeColor } from "@/lib/theme";
import { isPhone } from "./usePhone";

const standalone = () => document.documentElement.classList.contains("pwa");

function signedIn(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i++) if (isSessionKey(localStorage.key(i) ?? "")) return true;
  } catch { /* storage blocked: nobody is signed in */ }
  return false;
}

export function ServiceWorker() {
  const router = useRouter();

  // A theme chosen by hand, against the system's: the browser's bars follow it.
  useEffect(() => { if (readThemeChoice() !== "system") syncThemeColor(resolveTheme(readThemeChoice())); }, []);

  // The installed app's launch: a signed-in person goes to their Dashboard.
  useEffect(() => {
    if (!standalone() || !isPhone() || window.location.pathname !== "/" || window.location.hash) return;
    let launched = false;
    try { launched = sessionStorage.getItem("retcalc.launched") != null; sessionStorage.setItem("retcalc.launched", "1"); } catch { launched = true; }
    if (!launched && signedIn()) router.replace("/dashboard");
  }, [router]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    let reg: ServiceWorkerRegistration | undefined, timer: ReturnType<typeof setTimeout> | undefined;
    const saver = () => (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
    const warm = () => {
      if (!standalone() || saver() || !navigator.onLine) return;
      // The parts a calculator loads on demand, so the worker saves them.
      void import("@/lib/glossary").catch(() => {});
      void import("@/tools/help/HelpPanel").catch(() => {});
      void import("@/tools/guide/CoachBody").catch(() => {});
      navigator.serviceWorker.ready.then((r) => r.active?.postMessage({ type: "warm" }), () => {});
    };
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).then((r) => {
      reg = r;
      timer = setTimeout(warm, 4000);
    }, () => { /* no worker: the site works as it always has */ });
    const onShow = () => { if (document.visibilityState === "visible") reg?.update().catch(() => {}); };
    document.addEventListener("visibilitychange", onShow);
    return () => { document.removeEventListener("visibilitychange", onShow); clearTimeout(timer); };
  }, []);

  return null;
}
