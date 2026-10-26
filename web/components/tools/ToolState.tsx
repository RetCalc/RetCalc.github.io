"use client";

/* What every tool shares: its inputs, their defaults, and the header's
   saved-scenario, share and reset controls acting on them.

   A tool calls useToolState(def) for its inputs. The open tool registers
   itself here, and the masthead's ScenarioBar works on whichever tool is
   registered, so no tool wires those buttons up itself.

   Inputs are kept as the text in each field ("450,000", "6.71"), so what's
   saved, shared and restored is exactly what was on screen. */

import type { Cover, Monthly } from "@/tools/plan/kids";
import type { SavedHousehold } from "@/lib/household";
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { readSession, readStored, writeSession, writeStored } from "@/lib/storage";
import { useToast } from "@/components/shell/Toast";

export type ToolInputs = Record<string, string | string[] | unknown>;

export interface ToolDef<S extends ToolInputs> {
  /** Storage and share-link id: "mortgage", "debt", ... */
  id: string;
  /** "Mortgage", for "Reset the Mortgage inputs?" */
  label: string;
  /** What one saved scenario is called: "mortgage scenario". */
  noun: string;
  defaults: S;
  /** Whether the inputs hold work worth asking about before a saved
      scenario replaces them (the Guide's answers). Left off, loading a
      scenario replaces them without asking. */
  hasWork?: (state: S) => boolean;
  /** Puts right what a saved copy or share link can hold that the screen
      can't show (a dropdown's value that isn't one of its choices). */
  clean?: (state: S) => S;
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

/* A tool in a scope (the Dashboard) isn't the page's, so the header's save
   and share leave it alone, but its Help still reads its inputs: each
   scoped tool's latest, by id. */
const scoped = new Map<string, ToolInputs>();
const scopedListeners = new Set<() => void>();
function setScopedState(id: string, state: ToolInputs) {
  scoped.set(id, state);
  scopedListeners.forEach((l) => l());
}
/** A scoped tool's inputs as they stand, for its Help. */
export function useScopedState(id: string): ToolInputs | undefined {
  return useSyncExternalStore((l) => { scopedListeners.add(l); return () => scopedListeners.delete(l); }, () => scoped.get(id), () => undefined);
}

/* Saved scenarios, one list per tool, as retcalc.scenarios-<id>.v1. A list
   that doesn't read as one (edited by hand, or damaged) counts as empty, and
   an entry without a name is left out, so the header always draws. */
export function readScenarios(id: string): Scenario[] {
  const list = readStored<unknown>(`scenarios-${id}`, 1);
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  return list.filter((s): s is Scenario => {
    if (!s || typeof s !== "object" || typeof (s as Scenario).name !== "string" || !(s as Scenario).name.trim()) return false;
    if (seen.has((s as Scenario).name)) return false;
    seen.add((s as Scenario).name);
    return true;
  });
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
/** What a page says when its share link can't be read (cut short when it
    was copied, or edited). */
export const BROKEN_LINK = "This share link is incomplete or damaged, so its numbers couldn't be opened. Ask for the link again.";

export function encodeShare(id: string, data: ToolInputs): string {
  return "#s=" + encodeHash({ t: id, d: data });
}
function decodeShare(hash: string): { t: string; d: ToolInputs } | null {
  if (!hash.startsWith("#s=")) return null;
  const v = decodeHash(hash.slice(3)) as { t?: unknown; d?: unknown } | null;
  return v && typeof v.t === "string" && v.d && typeof v.d === "object" ? (v as { t: string; d: ToolInputs }) : null;
}

/** Whether a saved or shared value can stand in for a default: the same
    kind of thing (a list for a list, an object for an object), and a list
    whose defaults hold objects holds only objects. */
function sameKind(v: unknown, d: unknown): boolean {
  if (d === null) return typeof v === "object";
  if (v === null || typeof v !== typeof d) return false;
  if (Array.isArray(d)) {
    if (!Array.isArray(v)) return false;
    if (!d.length) return true;
    const first: unknown = d[0];
    if (first && typeof first === "object") return v.every((x) => !!x && typeof x === "object" && Array.isArray(x) === Array.isArray(first));
    return v.every((x) => x === null || typeof x !== "object");
  }
  if (typeof d === "object") return !Array.isArray(v);
  return true;
}

/** Fills in anything a saved or shared copy lacks from the defaults, and
    drops keys the tool no longer has, so an older copy still loads. A value
    of the wrong kind (from a damaged link or saved copy) keeps the
    default. */
export function withDefaults<S extends ToolInputs>(def: ToolDef<S>, data: ToolInputs): S {
  const { defaults } = def;
  const out = { ...defaults };
  if (!data || typeof data !== "object") return out;
  for (const k of Object.keys(defaults)) {
    const v = data[k];
    if (v !== undefined && sameKind(v, defaults[k])) (out as ToolInputs)[k] = v;
  }
  return def.clean ? def.clean(out) : out;
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

/* ---------- a tool scope ----------
   A page that runs tool screens inside it (the Paycheck to Retirement
   walkthrough) gives them its own copy of every tool's inputs: each tool
   reads and writes the scope's copy instead of the tab's, a tool's move to
   another tool's page becomes the page's own step, and the header's
   controls are left to the page. Outside a scope nothing changes. */
export interface ToolScope {
  /** The scope's name, which keeps its household fill apart from the tools'. */
  name: string;
  /** The scope's copy of a tool's inputs, if it has one. */
  read: (id: string) => ToolInputs | undefined;
  write: (id: string, data: ToolInputs) => void;
  /** A tool moving to a page ("/stages"): true when the scope took it. */
  go: (path: string) => boolean;
  /** The household this scope's tools take in, in place of the saved one:
      null for none. Left out, they take the saved one, as on their pages.
      Taken in once each time a tool opens, and never recorded. */
  household?: SavedHousehold | null;
  /** What the scope's own page adds inside a tool, by place: "afterSliders"
      is the Paycheck tab, after where the rest goes; "payFacts" takes the
      place of the Paycheck's pay, filing status, state and match fields,
      when the scope keeps those itself. */
  slots?: { afterSliders?: ReactNode; kidsSummary?: ReactNode; payFacts?: ReactNode };
  /** How the scope covers children's costs from saving, when it has its
      own order (the Dashboard's): today's saving by account, what a stage
      takes, and the order in words, for "How will you cover this?". */
  cover?: { today: Monthly; fn: (change: number, typed?: Partial<Monthly>) => Cover; order: string };
}
const ScopeContext = createContext<ToolScope | null>(null);
export const ToolScopeProvider = ScopeContext;
/** The scope this tool runs in, or null on its own page. */
export function useToolScope(): ToolScope | null {
  return use(ScopeContext);
}

/** Another tool's inputs, read and changed in the scope this one runs in. */
export interface ToolStore {
  read: <S extends ToolInputs>(id: string, fallback: S) => S;
  write: (id: string, data: ToolInputs) => void;
}
export const TAB_STORE: ToolStore = { read: toolInputs, write: setToolInputs };
export function useToolStore(): ToolStore {
  const scope = use(ScopeContext);
  return useMemo(() => scope
    ? { read: <S extends ToolInputs>(id: string, fallback: S) => (scope.read(id) as S | undefined) ?? fallback, write: scope.write }
    : TAB_STORE, [scope]);
}

/** Moves to another page, or to the scope's own step for it. */
export function useToolNav(): (path: string) => void {
  const scope = use(ScopeContext), router = useRouter();
  return useCallback((path: string) => { if (!scope?.go(path)) router.push(path); }, [scope, router]);
}

/** A tool's inputs. `set("price")(text)` updates one; `update({...})` several. */
/** `opening`: a change to the inputs as the page opens (a strategy page
    sets up its strategy). */
export function useToolState<S extends ToolInputs>(def: ToolDef<S>, opening?: (s: S) => S) {
  const scope = use(ScopeContext);
  const [state, setState] = useState<S>(() => {
    // In a scope, its copy (the scope is only drawn in the browser).
    if (scope) {
      const mine = scope.read(def.id);
      const s = mine ? withDefaults(def, mine) : def.defaults;
      return opening ? opening(s) : s;
    }
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
    if (scope) return;
    restoreSession();
    const saved = pending.get(def.id);
    if (!saved) return;
    pending.delete(def.id);
    filled.current = true;
    const s = withDefaults(def, saved);
    setState(openingRef.current ? openingRef.current(s) : s);
  }, [def, scope]);
  useEffect(() => {
    // The defaults this page rendered with must not overwrite what was
    // just read back.
    if (filled.current) {
      filled.current = false;
      return;
    }
    if (scope) scope.write(def.id, state);
    else remember(def.id, state);
  }, [def.id, state, scope]);

  // A share link for this tool opens with its inputs; one that doesn't
  // read says so rather than quietly showing other numbers.
  const toast = useToast();
  useEffect(() => {
    if (scope || !window.location.hash.startsWith("#s=")) return;
    const shared = decodeShare(window.location.hash);
    if (shared?.t === def.id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the link is only readable in the browser
      setState(withDefaults(def, shared.d));
    } else if (!shared) toast(BROKEN_LINK, "warn");
  }, [def, scope, toast]);

  // The header's controls see this tool, and its inputs as they change
  // (in a scope, the page's own register instead).
  useRegisterTool(def, state, (data) => setState(withDefaults(def, data)), !!scope);
  // In a scope Help still reads the tool's inputs as they change.
  useEffect(() => { if (scope) setScopedState(def.id, state); }, [scope, def.id, state]);

  const set = useCallback(
    <K extends keyof S>(k: K) => (v: S[K]) => setState((s) => ({ ...s, [k]: v })),
    [],
  );
  const update = useCallback((patch: Partial<S>) => setState((s) => ({ ...s, ...patch })), []);
  return { state, set, update, setState };
}

/** Makes a page's inputs the ones the header's controls (save, share,
    reset) work on: a tool's, or the readiness guide's plan. */
export function useRegisterTool<S extends ToolInputs>(def: ToolDef<S>, state: S, load: (data: ToolInputs) => void, off = false) {
  const { setActive } = use(RegistryContext);
  const latest = useRef(load);
  useEffect(() => {
    latest.current = load;
  });
  useEffect(() => {
    if (!off) setActive({ def: def as unknown as ToolDef<ToolInputs>, state, load: (d) => latest.current(d) });
  }, [def, state, setActive, off]);
  useEffect(() => () => { if (!off) setActive(null); }, [setActive, off]);
}
