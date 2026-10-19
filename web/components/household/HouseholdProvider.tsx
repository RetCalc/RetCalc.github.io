"use client";

/* Holds the household profile for the whole site. In the old single-page
   site every tool was on the page at once, so saving filled them all
   immediately. Here only the open tool is loaded, so each tool takes in a
   profile saved after it last did, when it's next shown (useHouseholdFill).
   The effect for the person is the same: save once, and every tool starts
   from those numbers, then is free to drift. */

import { createContext, use, useEffect, useMemo, useRef, useState } from "react";
import { HOUSEHOLD_STORE, HOUSEHOLD_TOOLS, type SavedHousehold } from "@/lib/household";
import { readStored, writeStored } from "@/lib/storage";
import { useToolScope } from "@/components/tools/ToolState";

/** The open tool's tie to the household: whether its inputs still match
    what the household fills in, and a way to fill them in again. */
export interface HouseholdLink {
  tool: string;
  /** The household gives this tool something to fill. */
  takes: boolean;
  /** The tool's inputs are what filling them in would give. */
  matches: boolean;
  /** Fills the household's numbers in again. */
  apply: () => void;
}

interface HouseholdState {
  /** null until read from this browser, and when nothing is saved. */
  profile: SavedHousehold | null;
  /** Saves the profile (null clears it); returns the tools it fills. */
  save: (h: SavedHousehold | null) => string[];
  /** The household panel (the profile's form, over the page). */
  panelOpen: boolean;
  setPanelOpen: (v: boolean) => void;
  /** The open tool's link, null on a page with no tool that takes it. */
  link: HouseholdLink | null;
  setLink: (l: HouseholdLink | null) => void;
}

const HouseholdContext = createContext<HouseholdState | null>(null);

export function useHousehold(): HouseholdState {
  const ctx = use(HouseholdContext);
  if (!ctx) throw new Error("useHousehold needs a HouseholdProvider above it");
  return ctx;
}

/* When each tool last took the profile in: {tool: savedAt}. */
const APPLIED = { key: "household-applied", version: 1 } as const;

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Ties a tool to the household. `fill` gives the tool's inputs with the
    household's numbers written in (and nothing else changed). It runs once
    for each profile saved since this tool last took one in: on opening the
    tool, and when the profile is saved while it's open. Running it on the
    current inputs also tells whether they still match the household, which
    the tool bar shows, with a way to fill them in again. */
export function useHouseholdFill<S>(own: string, state: S, setState: (f: (c: S) => S) => void, fill: (h: SavedHousehold, c: S) => S): void {
  const { profile, setLink } = useHousehold();
  // In a tool scope (a walkthrough), its copy takes the household in on its
  // own, and the tool bar's household status is the page's, not this tool's.
  const scope = useToolScope();
  const tool = scope ? scope.name + ":" + own : own;
  const latest = useRef(fill);
  useEffect(() => {
    latest.current = fill;
  });
  const savedAt = profile?.savedAt;
  useEffect(() => {
    if (!profile || savedAt == null) return;
    const applied = readStored<Record<string, number>>(APPLIED.key, APPLIED.version) ?? {};
    if ((applied[tool] ?? 0) >= savedAt) return;
    setState((c) => latest.current(profile, c));
    writeStored(APPLIED.key, APPLIED.version, { ...applied, [tool]: savedAt });
    // profile changes only when savedAt does
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, savedAt]);

  const takes = !!profile && (HOUSEHOLD_TOOLS.find((t) => t.id === own)?.takes(profile) ?? false);
  const matches = !!profile && same(fill(profile, state), state);
  useEffect(() => {
    if (!scope) setLink({ tool, takes, matches, apply: () => { if (profile) setState((c) => latest.current(profile, c)); } });
  }, [tool, takes, matches, profile, setState, setLink, scope]);
  useEffect(() => () => { if (!scope) setLink(null); }, [setLink, scope]);
}

export function HouseholdProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<SavedHousehold | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [link, setLink] = useState<HouseholdLink | null>(null);

  // Browser storage only exists after the page has loaded. A household
  // arriving from the account (lib/sync) is read in the same way.
  useEffect(() => {
    const read = () => setProfile(readStored<SavedHousehold>(HOUSEHOLD_STORE.key, HOUSEHOLD_STORE.version));
    read();
    const onSynced = (e: Event) => { if ((e as CustomEvent<string[]>).detail?.includes(HOUSEHOLD_STORE.key)) read(); };
    window.addEventListener("retcalc:synced", onSynced);
    return () => window.removeEventListener("retcalc:synced", onSynced);
  }, []);

  const value = useMemo<HouseholdState>(
    () => ({
      profile,
      panelOpen,
      setPanelOpen,
      link,
      setLink,
      save: (h) => {
        writeStored(HOUSEHOLD_STORE.key, HOUSEHOLD_STORE.version, h);
        setProfile(h);
        return h ? HOUSEHOLD_TOOLS.filter((t) => t.takes(h)).map((t) => t.name) : [];
      },
    }),
    [profile, panelOpen, link],
  );
  return <HouseholdContext value={value}>{children}</HouseholdContext>;
}
