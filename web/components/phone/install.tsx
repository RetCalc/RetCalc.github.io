"use client";

/* Putting RetCalc on the home screen.

   iPhone Safari has no install button of its own: the way in is Share, then
   "Add to Home Screen". So an iPhone Safari visitor is told once, in a small
   card above the tab bar that can be dismissed, and the same steps are
   always under More. "Once" is kept in this browser (KEY below): after the
   card has been shown, dismissed or not, it never comes back. It waits for
   a second page or half a minute, so it never greets a first-time visitor
   before they've seen anything.

   Android Chrome and desktop browsers offer their own install prompt; where
   the browser hands us one (beforeinstallprompt), More's row opens it.
   Already installed (html.pwa), nothing is offered. Styles:
   styles/phone/60-install.css. */

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { EllipsisIcon, PlusSquareIcon, ShareIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Brandmark } from "@/components/shell/Brandmark";
import { isPhone } from "./usePhone";

const KEY = "retcalc.install-hint.v1";
const HELP_EVENT = "retcalc:install-help";

interface InstallEvent extends Event { prompt: () => Promise<unknown> }
let offered: InstallEvent | null = null;
const listeners = new Set<() => void>();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); offered = e as InstallEvent; listeners.forEach((l) => l()); });
  window.addEventListener("appinstalled", () => { offered = null; listeners.forEach((l) => l()); });
}

const standalone = () => document.documentElement.classList.contains("pwa");
/** Safari itself on an iPhone or iPod (not Chrome or an app's built-in
    browser, which can't add to the home screen the same way). */
function iosSafari(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPod/.test(ua) && /Version\/[\d.]+.*Safari\//.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(ua);
}
const canInstall = () => !standalone() && (iosSafari() || !!offered);

/** Whether this browser can put RetCalc on the home screen and hasn't yet. */
export function useInstallable(): boolean {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, canInstall, () => false);
}

/** Opens the browser's own install prompt where there is one, the iPhone's
    steps otherwise. */
export function openInstallHelp() {
  if (offered) { void offered.prompt(); return; }
  window.dispatchEvent(new Event(HELP_EVENT));
}

const seen = () => { try { return localStorage.getItem(KEY) != null; } catch { return true; } };
const markSeen = () => { try { localStorage.setItem(KEY, JSON.stringify(Date.now())); } catch { /* private mode: it may show again */ } };

export function InstallPrompt() {
  const path = usePathname();
  const [card, setCard] = useState(false);
  const [help, setHelp] = useState(false);
  const pages = useRef(0);

  useEffect(() => {
    const on = () => setHelp(true);
    window.addEventListener(HELP_EVENT, on);
    return () => window.removeEventListener(HELP_EVENT, on);
  }, []);

  // Once: on the second page seen, or after half a minute on the first.
  useEffect(() => {
    if (!isPhone() || standalone() || !iosSafari() || seen()) return;
    // The Dashboard's setup and sign-in aren't the moment for it.
    if (path.startsWith("/dashboard/setup")) return;
    const show = () => { if (!seen()) { markSeen(); setCard(true); } };
    if (++pages.current >= 2) { show(); return; }
    const t = setTimeout(show, 30_000);
    return () => clearTimeout(t);
  }, [path]);

  return (
    <>
      {card ? (
        <div className="pinstall phone:hidden" role="region" aria-label="Add RetCalc to your Home Screen">
          <span className="pinstall-mark"><Brandmark /></span>
          <div className="pinstall-t">
            <b>Add RetCalc to your Home Screen</b>
            <span>Opens full screen, like an app.</span>
          </div>
          <Button size="sm" onClick={() => { setCard(false); setHelp(true); }}>Show me how</Button>
          <Button variant="ghost" size="icon" aria-label="Dismiss" onClick={() => setCard(false)}><XIcon aria-hidden="true" /></Button>
        </div>
      ) : null}
      <Sheet open={help} onOpenChange={setHelp}>
        <SheetContent aria-describedby={undefined}>
          <SheetHeader><SheetTitle>Add RetCalc to your Home Screen</SheetTitle></SheetHeader>
          <SheetBody>
            <ol className="pinstall-steps">
              <li><span><ShareIcon aria-hidden="true" /></span><div><b>Tap Share</b>The square with an arrow in Safari&apos;s toolbar. On newer iPhones it&apos;s under <EllipsisIcon className="pinstall-inl" aria-label="the three dots" />.</div></li>
              <li><span><PlusSquareIcon aria-hidden="true" /></span><div><b>Choose Add to Home Screen</b>Scroll down the list if you don&apos;t see it.</div></li>
              <li><span className="pinstall-mark"><Brandmark /></span><div><b>Tap Add</b>RetCalc opens from its own icon, full screen, and the calculators work without a connection.</div></li>
            </ol>
          </SheetBody>
          <SheetFooter><Button onClick={() => setHelp(false)}>Done</Button></SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
