"use client";

/* What every tool shares: its inputs, their defaults, and the header's
   saved-scenario, share and reset controls acting on them.

   A tool calls useToolState(def) for its inputs. The open tool registers
   itself here, and the masthead's ScenarioBar works on whichever tool is
   registered, so no tool wires those buttons up itself.

   Inputs are kept as the text in each field ("450,000", "6.71"), so what's
   saved, shared and restored is exactly what was on screen. */

import { createContext, use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { readSession, readStored, writeSession, writeStored } from "@/lib/storage";

export type ToolInputs = Record<string, string | string[] | unknown>;

export interface ToolDef<S extends ToolInputs> {
  /** Storage and share-link id: "mortgage", "debt", ... */
  id: string;
  /** "Mortgage", for "Reset the Mortgage inputs?" */
  label: string;
  /** What one saved scenario is called: "mortgage scenario". */
  noun: string;
  defaults: S;
}

export interface Scenario {
  name: string;
  data: unknown;
}

export interface ActiveTool {
  def: ToolDef<ToolInputs>;
  /** The inputs on screen now. */
  state: ToolInputs;
  load: (data: ToolInputs) => void;
}

interface Registry {
  active: ActiveTool | null;
  setActive: (t: ActiveTool | null) => void;
}

const RegistryContext = createContext<Registry>({ active: null, setActive: () => {} });

export function ToolRegistryProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState<ActiveTool | null>(null);
  const value = useMemo(() => ({ active, setActive }), [active]);
  return <RegistryContext value={value}>{children}</RegistryContext>;
}

export function useActiveTool(): ActiveTool | null {
  return use(RegistryContext).active;
}

/* Saved scenarios, one list per tool, as retcalc.scenarios-<id>.v1. */
export function readScenarios(id: string): Scenario[] {
  return readStored<Scenario[]>(`scenarios-${id}`, 1) ?? [];
}
export function writeScenarios(id: string, list: Scenario[]): void {
  writeStored(`scenarios-${id}`, 1, list);
}

/* Share links carry a tool's inputs in the address's #fragment, which never
   leaves the browser: #s=<base64url of {t: tool id, d: inputs}>. */
/** Any plain value as base64url text, for an address's #fragment. */
export function encodeHash(v: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(v));
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
/** The value encodeHash() wrote, or null if it doesn't read. */
export function decodeHash(text: string): unknown {
  try {
    const bin = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
  } catch {
    return null;
  }
}
export function encodeShare(id: string, data: ToolInputs): string {
  return "#s=" + encodeHash({ t: id, d: data });
}
function decodeShare(hash: string): { t: string; d: ToolInputs } | null {
  if (!hash.startsWith("#s=")) return null;
  const v = decodeHash(hash.slice(3)) as { t?: unknown; d?: unknown } | null;
  return v && typeof v.t === "string" && v.d && typeof v.d === "object" ? (v as { t: string; d: ToolInputs }) : null;
}

/** Fills in anything a saved or shared copy lacks from the defaults, and
    drops keys the tool no longer has, so an older copy still loads. */
function withDefaults<S extends ToolInputs>(defaults: S, data: ToolInputs): S {
  const out = { ...defaults };
  for (const k of Object.keys(defaults)) {
    const v = data[k];
    if (v !== undefined && typeof v === typeof defaults[k]) (out as ToolInputs)[k] = v;
  }
  return out;
}

/* Each tool's inputs, kept for this visit as you move between pages, the way
   the old single-page site kept them on screen. A reload keeps them too:
   each change is also written to the tab's session storage, and read back
   once the page has loaded (never while rendering, so the page still
   matches what the server sent). A closed tab or a new one starts fresh.
   Other tools read these too ("Copy from Budget"). */
const memory = new Map<string, ToolInputs>();

/* Every tool this tab has stored, as retcalc.tool-<id>.v1 in session storage. */
const IDS = "tool-ids";
const toolKey = (id: string) => `tool-${id}`;
let restored = false;
/** The tools' inputs a reload would otherwise have lost, by tool, until
    that tool's page takes its own (see useToolState). */
const pending = new Map<string, ToolInputs>();

/** Reads the tab's stored inputs into memory, once per page load. */
function restoreSession(): void {
  if (restored || typeof window === "undefined") return;
  restored = true;
  for (const id of readSession<string[]>(IDS, 1) ?? []) {
    const data = readSession<ToolInputs>(toolKey(id), 1);
    if (data && !memory.has(id)) {
      memory.set(id, data);
      pending.set(id, data);
    }
  }
}

function remember(id: string, data: ToolInputs): void {
  memory.set(id, data);
  pending.delete(id);
  writeSession(toolKey(id), 1, data);
  const ids = readSession<string[]>(IDS, 1) ?? [];
  if (!ids.includes(id)) writeSession(IDS, 1, [...ids, id]);
}

/** A tool's inputs as last left, or `fallback` if it hasn't been opened. */
export function toolInputs<S extends ToolInputs>(id: string, fallback: S): S {
  restoreSession();
  return (memory.get(id) as S | undefined) ?? fallback;
}
/** Changes another tool's inputs; it shows them when next opened. */
export function setToolInputs(id: string, data: ToolInputs): void {
  restoreSession();
  remember(id, data);
}

/** A tool's inputs. `set("price")(text)` updates one; `update({...})` several. */
/** `opening`: a change to the inputs as the page opens (a strategy page
    sets up its strategy). */
export function useToolState<S extends ToolInputs>(def: ToolDef<S>, opening?: (s: S) => S) {
  const [state, setState] = useState<S>(() => {
    // Memory only: reading session storage here would differ from the
    // server's render. The effect below fills that in.
    const s = (memory.get(def.id) as S | undefined) ?? def.defaults;
    return opening ? opening(s) : s;
  });
  /* After a reload the page was rendered from defaults, to match the
     server's; this fills in what the tab had stored. A strategy page still
     sets up its own strategy. */
  const openingRef = useRef(opening);
  useEffect(() => {
    openingRef.current = opening;
  });
  const filled = useRef(false);
  useEffect(() => {
    restoreSession();
    const saved = pending.get(def.id);
    if (!saved) return;
    pending.delete(def.id);
    filled.current = true;
    const s = withDefaults(def.defaults, saved);
    setState(openingRef.current ? openingRef.current(s) : s);
  }, [def]);
  useEffect(() => {
    // The defaults this page rendered with must not overwrite what was
    // just read back.
    if (filled.current) {
      filled.current = false;
      return;
    }
    remember(def.id, state);
  }, [def.id, state]);

  // A share link for this tool opens with its inputs.
  useEffect(() => {
    const shared = decodeShare(window.location.hash);
    if (shared?.t === def.id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the link is only readable in the browser
      setState(withDefaults(def.defaults, shared.d));
    }
  }, [def]);

  // The header's controls see this tool, and its inputs as they change.
  useRegisterTool(def, state, (data) => setState(withDefaults(def.defaults, data)));

  const set = useCallback(
    <K extends keyof S>(k: K) => (v: S[K]) => setState((s) => ({ ...s, [k]: v })),
    [],
  );
  const update = useCallback((patch: Partial<S>) => setState((s) => ({ ...s, ...patch })), []);
  return { state, set, update, setState };
}

/** Makes a page's inputs the ones the header's controls (save, share,
    reset) work on: a tool's, or the readiness guide's plan. */
export function useRegisterTool<S extends ToolInputs>(def: ToolDef<S>, state: S, load: (data: ToolInputs) => void) {
  const { setActive } = use(RegistryContext);
  const latest = useRef(load);
  useEffect(() => {
    latest.current = load;
  });
  useEffect(() => {
    setActive({ def: def as unknown as ToolDef<ToolInputs>, state, load: (d) => latest.current(d) });
  }, [def, state, setActive]);
  useEffect(() => () => setActive(null), [setActive]);
}
