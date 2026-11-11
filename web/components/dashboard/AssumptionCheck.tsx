"use client";

/* How your assumptions compare, on the Plan summary: the plan as a whole
   on a five-band scale from very conservative to very aggressive, shown
   in full even when folded, then, opened in the same box, each guess the
   plan makes against its balanced figure, with what it does to savings at
   retirement. The figures come from assumptions.ts; the plan is run again
   for each, after the page draws. */

import Link from "next/link";
import { useEffect, useState } from "react";
import { PencilIcon, ScaleIcon } from "lucide-react";
import { TipDot } from "@/components/shell/Tooltips";
import { BANDS, BAND_WORDS, type Band } from "./assume-bench";
import { GROUP_NAMES, SHORT, rateAssumptions, type GroupId, type Rating, type Row } from "./assumptions";
import { money } from "./format";
import type { Results } from "./model";
import type { Entry, Profile } from "./store";
import { Fold, TipLabel } from "./ui";

/** The rating, worked out after the page draws (it's a few runs of the plan). */
export function useRating(pr: Profile, entries: Entry[], R: Results): Rating | null | undefined {
  const key = JSON.stringify([pr, entries]);
  const [st, setSt] = useState<{ key: string; r: Rating | null } | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setSt({ key, r: rateAssumptions(pr, entries, R) }), 0);
    return () => clearTimeout(t);
  }, [key, pr, entries, R]);
  // The last answer shows until the new one is in.
  return st ? st.r : undefined;
}

/** The scale: five equal segments, cool toward conservative and warm
    toward aggressive, Balanced in the middle; a marker where the figure
    sits. The large one names the bands under it. */
export function Scale({ pos, band, size = "lg", label }: { pos: number; band: Band; size?: "lg" | "sm"; label: string }) {
  return (
    <div className={"dsh-ac-scale dsh-ac-" + size} role="img" aria-label={label}>
      <div className="dsh-ac-bar">
        <div className="dsh-ac-track">{BANDS.map((b) => <i key={b} data-b={b} />)}</div>
        <span className="dsh-ac-mark" style={{ "--p": pos.toFixed(4) } as React.CSSProperties} />
      </div>
      {size === "lg" ? <div className="dsh-ac-words" aria-hidden="true">{BANDS.map((b) => <span key={b} data-b={b} data-on={b === band ? "" : undefined}>{BAND_WORDS[b]}</span>)}</div> : null}
    </div>
  );
}

const signed = (v: number) => (Math.abs(v) < 500 ? "—" : (v > 0 ? "+" : "−") + money(Math.round(Math.abs(v) / 1000) * 1000));
const round = (v: number) => money(Math.round(v / 1000) * 1000);

/** The plan in a sentence: where it leans, and the guess that leans it most. */
function leadWords(r: Rating): string {
  if (r.band === "bal") return "Your plan's guesses about the future are balanced.";
  const more = r.band === "aggr" || r.band === "vaggr";
  return `Your plan assumes ${more ? "a kinder" : "a tougher"} future than balanced assumptions${r.lead ? ", mostly from " + SHORT[r.lead.id] : ""}.`;
}

function RowLine({ row }: { row: Row }) {
  // The last word kept with its "?", so a narrow column never strands the dot.
  const cut = row.name.lastIndexOf(" ") + 1, head = row.name.slice(0, cut), last = row.name.slice(cut);
  return (
    <div className="dsh-ac-row" role="row">
      <div className="dsh-ac-name" role="cell">{head}<span className="tipglue">{last} <TipDot k="" title={row.name} text={row.why} /></span></div>
      <div className="dsh-ac-yours" role="cell">{row.yours}</div>
      <div className="dsh-ac-bal" role="cell">{row.balanced}<span>{row.range}</span></div>
      <div className="dsh-ac-at" role="cell"><Scale pos={row.pos} band={row.band} size="sm" label={row.name + ": " + BAND_WORDS[row.band]} /></div>
      <div className="dsh-ac-band" role="cell"><span className="dsh-ac-badge" data-b={row.band}>{BAND_WORDS[row.band]}</span></div>
      <div className="dsh-ac-fx" role="cell">{signed(row.dollars)}{row.worth && Math.abs(row.dollars) >= 500 ? <TipDot k="" title="Worth at retirement" text="Social Security and how long the plan runs don't change savings at retirement. This is what the difference in the years they change is worth then." /> : null}</div>
      <Link className="dsh-ac-to" role="cell" href={row.href} aria-label={"Change on " + row.where} data-tip="" data-tip-text={"Change on " + row.where}><PencilIcon aria-hidden="true" /></Link>
    </div>
  );
}

function Detail({ r }: { r: Rating }) {
  const groups = (Object.keys(GROUP_NAMES) as GroupId[]).map((g) => ({ g, rows: r.rows.filter((x) => x.group === g) })).filter((x) => x.rows.length);
  return (
    <div className="dsh-ac">
      <div className="dsh-ac-top">
        <p className="dsh-ac-lead">{leadWords(r)}</p>
        <div className="dsh-ac-figs">
          <div><div className="dsh-label">Savings at retirement, your assumptions</div><div className="dsh-fig dsh-md">{round(r.mine)}</div></div>
          <div><div className="dsh-label"><TipLabel text="With balanced assumptions" id="acBalanced" /></div><div className="dsh-fig dsh-md">{round(r.balanced)}</div></div>
        </div>
      </div>
      <div className="dsh-ac-table" role="table" aria-label="Each assumption against its balanced figure">
        <div className="dsh-ac-row dsh-ac-head" role="row">
          <span role="columnheader">Assumption</span><span role="columnheader">Yours</span><span role="columnheader">Balanced</span>
          <span role="columnheader" className="dsh-ac-at">Where it sits</span><span role="columnheader" className="dsh-ac-band">Rating</span>
          <span role="columnheader" className="dsh-ac-fx">At retirement</span><span />
        </div>
        {groups.map(({ g, rows }) => (
          <div key={g} role="rowgroup">
            <div className="dsh-ac-gh" role="row"><span role="cell">{GROUP_NAMES[g]}</span></div>
            {rows.map((row) => <RowLine key={row.id} row={row} />)}
          </div>
        ))}
      </div>
    </div>
  );
}

/** The Plan summary's fold: the whole scale in view, the detail opened in place. */
export function AssumptionCheck({ pr, entries, R }: { pr: Profile; entries: Entry[]; R: Results }) {
  const r = useRating(pr, entries, R);
  if (r === null) return null;
  const summary = r
    ? <><span className="dsh-ac-word" data-b={r.band}>{BAND_WORDS[r.band]}</span>{r.lead ? <>, mostly from {SHORT[r.lead.id]}</> : null}</>
    : "Comparing your figures with balanced ones…";
  return (
    <Fold icon={ScaleIcon} title="How your assumptions compare" summary={summary} id="assumption-check"
      below={r ? <Scale pos={r.pos} band={r.band} label={"Your assumptions overall: " + BAND_WORDS[r.band]} /> : null}>
      {r ? <Detail r={r} /> : null}
    </Fold>
  );
}

/** The rating in a few words, linking to the whole of it on the Plan
    summary: for the Dashboard's assumptions line. */
export function AssumptionChip({ pr, entries, R }: { pr: Profile; entries: Entry[]; R: Results }) {
  const r = useRating(pr, entries, R);
  if (!r) return null;
  return (
    <> <Link className="dsh-ac-chip" href="/dashboard/summary#assumption-check">
      <span>Your assumptions:</span><span className="dsh-ac-badge" data-b={r.band}>{BAND_WORDS[r.band]}</span>
    </Link></>
  );
}
