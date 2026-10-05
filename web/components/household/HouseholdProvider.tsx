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

interface HouseholdState {
  /** null until read from this browser, and when nothing is saved. */
  profile: SavedHousehold | null;
  /** Saves the profile (null clears it); returns the tools it fills. */
  save: (h: SavedHousehold | null) => string[];
  /** Whether the bar shows at the top of the page; hiding it lasts this visit. */
  shown: boolean;
  setShown: (v: boolean) => void;
}

const HouseholdContext = createContext<HouseholdState | null>(null);

export function useHousehold(): HouseholdState {
  const ctx = use(HouseholdContext);
  if (!ctx) throw new Error("useHousehold needs a HouseholdProvider above it");
  return ctx;
}

/* When each tool last took the profile in: {tool: savedAt}. */
const APPLIED = { key: "household-applied", version: 1 } as const;

/** Runs `apply` once for each profile saved since this tool last took one
    in: on opening the tool, and when the profile is saved while it's open. */
export function useHouseholdFill(tool: string, apply: (h: SavedHousehold) => void): void {
  const { profile } = useHousehold();
  const latest = useRef(apply);
  useEffect(() => {
    latest.current = apply;
  });
  const savedAt = profile?.savedAt;
  useEffect(() => {
    if (!profile || savedAt == null) return;
    const applied = readStored<Record<string, number>>(APPLIED.key, APPLIED.version) ?? {};
    if ((applied[tool] ?? 0) >= savedAt) return;
    latest.current(profile);
    writeStored(APPLIED.key, APPLIED.version, { ...applied, [tool]: savedAt });
    // profile changes only when savedAt does
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, savedAt]);
}

export function HouseholdProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<SavedHousehold | null>(null);
  const [shown, setShown] = useState(true);

  // Browser storage only exists after the page has loaded.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one read of browser storage after hydration
    setProfile(readStored<SavedHousehold>(HOUSEHOLD_STORE.key, HOUSEHOLD_STORE.version));
  }, []);

  const value = useMemo<HouseholdState>(
    () => ({
      profile,
      shown,
      setShown,
      save: (h) => {
        writeStored(HOUSEHOLD_STORE.key, HOUSEHOLD_STORE.version, h);
        setProfile(h);
        return h ? HOUSEHOLD_TOOLS.filter((t) => t.takes(h)).map((t) => t.name) : [];
      },
    }),
    [profile, shown],
  );
  return <HouseholdContext value={value}>{children}</HouseholdContext>;
}
