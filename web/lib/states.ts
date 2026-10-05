/* US states (and DC) as the dropdowns list them: by name, valued by code.
   Read from the engine's tax tables. Pages that don't calculate anything get
   this list from the server instead of loading the engine for it. */
import { STATES } from "@/lib/engine/typed";

export interface StateOption { code: string; name: string }

const names = STATES as Record<string, { n: string }>;

export const STATE_OPTIONS: StateOption[] = Object.keys(names)
  .sort((a, b) => names[a].n.localeCompare(names[b].n))
  .map((code) => ({ code, name: names[code].n }));
