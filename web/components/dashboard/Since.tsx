"use client";

/* The Overview's "Since <date>": what changed between an earlier entry and
   now. Net worth, split into what the plan saved and the rest; the
   retirement spending the plan supports and the chance of success, as the
   plan stood that day against the plan as it is now (progress.ts). */

import { useMemo } from "react";
import { HistoryIcon } from "lucide-react";
import { longDate, money, money10, pctDown } from "./format";
import type { Results } from "./model";
import { sinceBase, splitChange } from "./progress";
import { supportedSpend } from "./snapshot";
import { netWorth, type DashData } from "./store";
import { Stat, Tile, Tip } from "./ui";

/** A change with its arrow, in the gain or loss color. */
function Chg({ v, text }: { v: number; text: string }) {
  if (Math.abs(v) < 0.5) return <span className="dsh-chg">No change</span>;
  return <span className={v > 0 ? "dsh-chg dsh-up" : "dsh-chg dsh-dn"}>{v > 0 ? "↑" : "↓"} {text}</span>;
}

/** "May 3" this year, "May 3, 2025" before it. */
const shortDate = (iso: string) => { const s = longDate(iso); return iso.slice(0, 4) === String(new Date().getFullYear()) ? s.replace(/, \d{4}$/, "") : s; };

export function SinceTile({ data, R }: { data: DashData; R: Results }) {
  const base = sinceBase(data.entries);
  const last = data.entries[data.entries.length - 1];
  // The spending the plan supports now: the same search the snapshot made then.
  const supports = useMemo(() => (base && R.S ? supportedSpend(data.profile, data.entries) : null), [base, R.S, data.profile, data.entries]);
  if (!base || !last) return null;
  const P = base.plan, change = netWorth(last) - P.nw;
  const split = splitChange(change, base, last.date);
  const words = (v: number) => (v >= 0 ? `${money(v)} from markets and other changes` : `${money(-v)} lost to markets and other changes`);
  const was = (v: string) => <>from {v}</>;
  return (
    <Tile id="since" icon={HistoryIcon} title={"Since " + shortDate(base.date)} tip="since" className="dsh-since"
      right={<span className="dsh-cap">Your plan then and now</span>}>
      <div className="dsh-stats">
        <Stat label="Net worth" keyFig value={<>{change >= 0 ? "+" : "−"}{money(Math.abs(change))}</>}
          sub={P.saving > 0 && split.saved > 0 ? <>{money(split.saved)} saved, {words(split.other)}</> : `${money(P.nw)} then, ${money(netWorth(last))} now`} />
        <Stat label={<>Spending your plan supports <Tip id="supports" title="Spending your plan supports" /></>}
          value={supports != null ? <>{money10(supports)}<small data-u="/mo">per month</small></> : "—"}
          sub={P.supports != null && supports != null ? <><Chg v={Math.round((supports - P.supports) / 10) * 10} text={money10(Math.abs(supports - P.supports))} /> {was(money10(P.supports) + " per month")}</> : P.supports != null ? was(money10(P.supports) + " per month") : "Not worked out then"} />
        <div className="dsh-stat">
          <div className="dsh-label">Chance of success <Tip id="chance" title="Chance of success" /></div>
          <div className="dsh-fig dsh-md">{R.success != null ? pctDown(R.success) + "%" : "—"}</div>
          <div className="dsh-cap dsh-mt6">{P.chance != null && R.success != null
            ? <><Chg v={pctDown(R.success) - pctDown(P.chance)} text={`${Math.abs(pctDown(R.success) - pctDown(P.chance)).toFixed(1).replace(/\.0$/, "")} points`} /> {was(pctDown(P.chance) + "%")}</>
            : P.chance != null ? was(pctDown(P.chance) + "%") : "Not worked out then"}</div>
        </div>
      </div>
    </Tile>
  );
}
