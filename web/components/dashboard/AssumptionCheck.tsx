"use client";

/* How your assumptions compare, on the Plan summary: the plan as a whole
   on a five-band scale from very conservative to very aggressive, then
   each guess the plan makes, against its usual figure, with what it does
   to savings at retirement. The figures come from assumptions.ts; the plan
   is run again for each, after the page draws. */

import Link from "next/link";
import { useEffect, useState } from "react";
import { ScaleIcon } from "lucide-react";
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

/** The scale: five equal segments, Balanced shaded in the middle, the
    ends tinted alike, a marker where the figure sits. */
export function Scale({ pos, band, size = "lg", label }: { pos: number; band: Band; size?: "lg" | "sm" | "xs"; label: string }) {
  return (
    <div className={"dsh-ac-scale dsh-ac-" + size} role="img" aria-label={label}>
      <div className="dsh-ac-bar">
        <div className="dsh-ac-track">{BANDS.map((b) => <i key={b} data-b={b} />)}</div>
        <span className="dsh-ac-mark" style={{ "--p": pos.toFixed(4) } as React.CSSProperties} />
      </div>
      {size === "lg" ? <div className="dsh-ac-words" aria-hidden="true">{BANDS.map((b) => <span key={b} data-on={b === band ? "" : undefined}>{BAND_WORDS[b]}</span>)}</div> : null}
    </div>
  );
}

const signed = (v: number) => (Math.abs(v) < 500 ? "—" : (v > 0 ? "+" : "−") + money(Math.round(Math.abs(v) / 1000) * 1000));

function Lead({ r }: { r: Rating }) {
  const from = r.lead ? <>, mostly from {SHORT[r.lead.id]}</> : null;
  if (r.band === "bal") return <p className="dsh-ac-lead">Your plan&apos;s guesses about the future are close to the usual figures.</p>;
  const more = r.band === "aggr" || r.band === "vaggr";
  return <p className="dsh-ac-lead">Your plan assumes {more ? "a kinder" : "a tougher"} future than the usual figures{from}.</p>;
}

function RowLine({ row }: { row: Row }) {
  // The last word kept with its "?", so a narrow column never strands the dot.
  const cut = row.name.lastIndexOf(" ") + 1, head = row.name.slice(0, cut), last = row.name.slice(cut);
  return (
    <div className="dsh-ac-row">
      <div className="dsh-ac-name">{head}<span className="tipglue">{last} <TipDot k="" title={row.name} text={row.why} /></span></div>
      <div className="dsh-ac-yours"><span className="dsh-ac-k">Yours</span>{row.yours}</div>
      <div className="dsh-ac-usual"><span className="dsh-ac-k">Usual</span>{row.usual}<span className="dsh-cap">Balanced: {row.range}</span></div>
      <Scale pos={row.pos} band={row.band} size="sm" label={row.name + ": " + BAND_WORDS[row.band]} />
      <div className="dsh-ac-band"><span className="dsh-badge" data-b={row.band}>{BAND_WORDS[row.band]}</span></div>
      <div className="dsh-ac-fx">
        <b>{signed(row.dollars)}</b>
        {Math.abs(row.dollars) >= 500 ? <span className="dsh-cap">{row.worth ? "worth at retirement" : "at retirement"}</span> : null}
      </div>
      <Link className="dsh-ac-to" href={row.href}>Change on {row.where}</Link>
    </div>
  );
}

function Detail({ r }: { r: Rating }) {
  const groups = (Object.keys(GROUP_NAMES) as GroupId[]).map((g) => ({ g, rows: r.rows.filter((x) => x.group === g) })).filter((x) => x.rows.length);
  return (
    <section className="dsh-tile dsh-ac">
      <div className="dsh-ac-top">
        <div>
          <div className="dsh-label">Your assumptions, overall</div>
          <div className="dsh-ac-word">{BAND_WORDS[r.band]}</div>
          <Lead r={r} />
        </div>
        <div className="dsh-stats dsh-ac-stats">
          <div className="dsh-stat"><div className="dsh-label">Savings at retirement, your figures</div><div className="dsh-fig dsh-md">{money(Math.round(r.mine / 1000) * 1000)}</div></div>
          <div className="dsh-stat"><div className="dsh-label"><TipLabel text="With the usual figures" id="acUsual" /></div><div className="dsh-fig dsh-md">{money(Math.round(r.usual / 1000) * 1000)}</div></div>
        </div>
      </div>
      <Scale pos={r.pos} band={r.band} label={"Your assumptions overall: " + BAND_WORDS[r.band]} />
      {groups.map(({ g, rows }) => (
        <div key={g} className="dsh-ac-group">
          <h3 className="dsh-ac-gh">{GROUP_NAMES[g]}</h3>
          {rows.map((row) => <RowLine key={row.id} row={row} />)}
        </div>
      ))}
    </section>
  );
}

/** The Plan summary's fold: the rating in a line, the whole of it opened. */
export function AssumptionCheck({ pr, entries, R }: { pr: Profile; entries: Entry[]; R: Results }) {
  const r = useRating(pr, entries, R);
  if (r === null) return null;
  const summary = r ? (
    <span className="dsh-ac-sum">
      <Scale pos={r.pos} band={r.band} size="xs" label={BAND_WORDS[r.band]} />
      <span><b>{BAND_WORDS[r.band]}</b>{r.lead ? <>, mostly from {SHORT[r.lead.id]}</> : null}</span>
    </span>
  ) : "Comparing your figures with the usual ones…";
  return (
    <Fold icon={ScaleIcon} title="How your assumptions compare" summary={summary} id="assumption-check">
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
      <span>Your assumptions:</span><span className="dsh-badge" data-b={r.band}>{BAND_WORDS[r.band]}</span>
    </Link></>
  );
}
