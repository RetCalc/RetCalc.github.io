"use client";

/* What every tool shares: its inputs, their defaults, and the header's
   saved-scenario, share and reset controls acting on them.

   A tool calls useToolState(def) for its inputs. The open tool registers
   itself here, and the masthead's ScenarioBar works on whichever tool is
   registered, so no tool wires those buttons up itself.

   Inputs are kept as the text in each field ("450,000", "6.71"), so what's
   saved, shared and restored is exactly what was on screen. */

import { createContext, use, useCallback, useEffect, useMemo, useState } from "react";
import { readStored, writeStored } from "@/lib/storage";

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
export function encodeShare(id: string, data: ToolInputs): string {
  const bytes = new TextEncoder().encode(JSON.stringify({ t: id, d: data }));
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return "#s=" + btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function decodeShare(hash: string): { t: string; d: ToolInputs } | null {
  if (!hash.startsWith("#s=")) return null;
  try {
    const b64 = hash.slice(3).replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64);
    const json = new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
    const v = JSON.parse(json);
    return v && typeof v.t === "string" && v.d && typeof v.d === "object" ? v : null;
  } catch {
    return null;
  }
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

/** A tool's inputs. `set("price")(text)` updates one; `update({...})` several. */
export function useToolState<S extends ToolInputs>(def: ToolDef<S>) {
  const [state, setState] = useState<S>(def.defaults);
  const { setActive } = use(RegistryContext);

  // A share link for this tool opens with its inputs.
  useEffect(() => {
    const shared = decodeShare(window.location.hash);
    if (shared?.t === def.id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the link is only readable in the browser
      setState(withDefaults(def.defaults, shared.d));
    }
  }, [def]);

  // The header's controls see this tool, and its inputs as they change.
  useEffect(() => {
    setActive({
      def: def as unknown as ToolDef<ToolInputs>,
      state,
      load: (data) => setState(withDefaults(def.defaults, data)),
    });
  }, [def, state, setActive]);
  useEffect(() => () => setActive(null), [setActive]);

  const set = useCallback(
    <K extends keyof S>(k: K) => (v: S[K]) => setState((s) => ({ ...s, [k]: v })),
    [],
  );
  const update = useCallback((patch: Partial<S>) => setState((s) => ({ ...s, ...patch })), []);
  return { state, set, update, setState };
}
