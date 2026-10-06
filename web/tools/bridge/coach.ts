/* The "Compare the routes" checklist a panel walking through the Early
   Retirement Bridge shows (the guide's coach and Tool Help say the same):
   every route the page lists, ticked off as each is opened. `seen` keeps
   the routes opened so far. From 29-guide-trips.js and 32-tool-help.js. */
import { bridgeRun, q } from "@/lib/tool-reads";
import type { BridgeInputs } from "./model";

export function routeTasks(s: BridgeInputs, seen: Record<string, 1>): { h: string; ok?: boolean }[] {
  const sel = q("#brCompare tr.sel")?.getAttribute("data-plan");
  if (sel) seen[sel] = 1;
  const n = Object.keys(seen).length, run = bridgeRun(s), live = (k: string) => !!run && run.live.some((p) => p.key === k);
  const row = (k: string, h: string) => ({ h, ok: seen[k] ? true : undefined });
  const T = [{ h: "<b>Ways to 59½</b> lists every route. Click a few rows to see each one play out below." + (n > 1 ? "<em>" + n + " tried</em>" : ""), ok: n >= 3 ? true : undefined }];
  if (live("ladder")) T.push(row("ladder", "<b>Roth conversion ladder</b>: move a year's spending into a Roth each year and spend it five years later. The first five years need another source."));
  if (live("sepp")) T.push(row("sepp", "<b>72(t) payments</b>: fixed yearly payments from an IRA with no penalty, but locked in until 59½ or for five years, whichever is later."));
  T.push(row("brok", "<b>Brokerage, then Roth contributions</b>: often nearly tax-free, but it only lasts as long as those accounts do."));
  if (live("r55")) T.push(row("r55", "<b>Rule of 55</b>: draw the 401(k) you left, penalty-free."));
  T.push({ h: "<b>Pay the 10% penalty</b> is there to compare against: look at its <b>Penalties</b> column.", ok: undefined });
  return T;
}
