"use client";

/* Up to three saved retirement scenarios side by side: their balances on
   one chart, every result with its difference from the first, and their
   inputs with the differences marked. From src/js/app/05-compare.js and
   src/main/04-compare.html.

   Laid out answer-first (the Compare critique, 2026-10-06): the slots are
   peers, so there is no hero and no amber. Each slot's pickers sit on one
   row with its reading under them: its balance in today's dollars (a row of
   the Results table) and its difference from A (that row's difference
   cell). From 1024px the slots take a third of the width beside the chart;
   below that they stack above it. The tables follow, each difference
   beside the scenario it belongs to. */

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { InfoIcon } from "lucide-react";
import { Legend } from "@/components/charts/Legend";
import { MULTI_COLORS, MultiChart } from "@/components/charts/MultiChart";
import { useHousehold } from "@/components/household/HouseholdProvider";
import { CsvButton } from "@/components/common/CsvButton";
import { fmtNum } from "@/lib/format";
import { compareNav } from "@/lib/compare-nav";
import { useClient } from "@/lib/useClient";
import { DDCompare } from "./DDCompare";
import {
  CMP_LETTERS, CMP_MODES, CMP_MODE_LABEL, cmpDelta, cmpFmt, cmpRun, openingSlots, rememberSlots, savedNames,
  type CmpMode, type Slot,
} from "./model";
import { CompareHead, SlotError, SlotFigure, SlotHint, SlotRow, SlotSecond } from "./Slot";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { buttonVariants } from "@/components/ui/button";

const LINK = buttonVariants({ variant: "link", size: "inline" });
import { cn } from "@/lib/utils";

const HELP = "Comparison reads saved scenarios only, exactly as they were saved. Nothing here changes the numbers on the Basic, Advanced or Stages tabs.";

/* The Results row each slot's reading shows: the balance in today's
   dollars, as the chart draws it. */
const KEY_ROW: Record<CmpMode, string> = { basic: "Value at retirement", advanced: "Inflation adjusted", stages: "Inflation adjusted" };
const KEY_LABEL: Record<CmpMode, string> = { basic: "Value at retirement", advanced: "Future value, inflation adjusted", stages: "Future value, inflation adjusted" };

/* Saved scenarios live in this browser, so the page fills in once it's here. */
export function Compare() {
  if (!useClient()) return <div className="stack" id="tab-compare" />;
  // opened from the Drawdown Simulator, it compares that tool's scenarios
  return compareNav.from === "drawdown" ? <DDCompare /> : <CompareSaved />;
}

function CompareSaved() {
  const { profile } = useHousehold();
  const [slots, setSlotsState] = useState<Slot[]>(() => openingSlots(compareNav.from));
  const outRef = useRef<HTMLTableElement>(null), inRef = useRef<HTMLTableElement>(null);
  const setSlots = (next: Slot[]) => {
    rememberSlots(next);
    setSlotsState(next);
  };

  const total = CMP_MODES.reduce((a, m) => a + savedNames(m).length, 0);
  const all = useMemo(() => slots.map((sl, i) => ({ ...sl, i, run: cmpRun(sl.mode, sl.name, profile) })), [slots, profile]);
  const live = all.filter((x) => x.run);
  const blank = all.filter((x) => x.name && !x.run);
  const enough = total >= 2;
  const mixed = new Set(live.map((x) => x.mode)).size > 1;

  /* results, with a difference column against the first scenario */
  const labels: string[] = [], kinds: Record<string, Parameters<typeof cmpFmt>[1]> = {};
  live.forEach((x) => x.run!.out.forEach((r) => {
    if (!labels.includes(r.k)) {
      labels.push(r.k);
      kinds[r.k] = r.kind;
    }
  }));
  const valOf = (x: (typeof live)[number], k: string) => x.run!.out.find((r) => r.k === k)?.n ?? null;
  const deltaOf = (x: (typeof live)[number], k: string) => cmpDelta(valOf(live[0], k), valOf(x, k), kinds[k]);
  // A difference column that no row fills (scenarios from two calculators
  // share no results) would be all dashes, so it's left out.
  const withDelta = new Set(live.slice(1).filter((x) => labels.some((k) => deltaOf(x, k))).map((x) => x.i));
  const ilabels: string[] = [];
  live.forEach((x) => x.run!.inp.forEach(([k]) => { if (!ilabels.includes(k)) ilabels.push(k); }));
  const head = (x: (typeof live)[number]) => CMP_LETTERS[x.i] + " · " + x.name;
  const swatch = (i: number) => <i className="mr-1.5 inline-block size-2 rounded-xs bg-(--swatch) align-middle" style={{ "--swatch": MULTI_COLORS[i] } as React.CSSProperties} aria-hidden="true"></i>;
  const base = live[0];

  /* A slot's reading: its balance, and how it sets against A. */
  const reading = (x: (typeof all)[number]) => {
    const k = KEY_ROW[x.mode], v = x.run!.out.find((r) => r.k === k);
    if (!v) return null;
    let second: React.ReactNode;
    if (x === base) second = <SlotSecond note={live.length > 1 ? "The baseline the others are set against" : "Pick a second scenario to compare"} />;
    else {
      const d = deltaOf(x, k);
      second = d ? (d.t === "—" ? <SlotSecond note="The same as A" /> : <SlotSecond value={d.t} note={"from " + CMP_LETTERS[base!.i]} />)
        : <SlotSecond note={"A is from another calculator, so there's no difference to show"} />;
    }
    return <SlotFigure id={"cmpFig" + x.i} label={KEY_LABEL[x.mode]} value={cmpFmt(v.n, v.kind)}>{second}</SlotFigure>;
  };

  return (
    <div className="grid grid-cols-1 items-start gap-5 max-sm:gap-3.5 lg:grid-cols-3" id="tab-compare">
      <CompareHead backId="cmpBack" title="Compare scenarios">
        <span id="cmpHelp" hidden={!enough}>
          {HELP}
          {blank.length ? <>{" "}<b className="font-semibold text-foreground">{blank.map((x) => x.name + " has nothing saved for " + CMP_MODE_LABEL[x.mode]).join("; ") + "."}</b></> : null}
        </span>
      </CompareHead>

      <Card className="col-span-full" hidden={enough}>
        <div className="flex items-start gap-2.5 px-4.5 text-body max-sm:px-4" id="cmpEmpty" hidden={enough}>
          {enough ? null : <>
            <InfoIcon className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <p className="m-0 max-w-copy">You have {total ? "one saved scenario" : "no saved scenarios"}. Compare needs at least two: set up a plan
              on <Link href="/" className={LINK}>Basic</Link>, <Link href="/advanced" className={LINK}>Advanced</Link> or <Link href="/stages" className={LINK}>Stages</Link>, save
              it with Save or delete (the disk button in the bar above), then change it and save again.</p>
          </>}
        </div>
      </Card>

      <Card size="flush" className="min-w-0 lg:self-stretch" hidden={!enough}>
        <div id="cmpPickers">
          {enough ? slots.map((sl, i) => {
            const names = savedNames(sl.mode), x = all[i];
            const none = !names.length;
            return (
              <SlotRow key={i} i={i} pickers={<>
                <NativeSelect className="min-w-0 flex-1" data-cmp={i} aria-label={"Scenario " + CMP_LETTERS[i]} value={sl.name}
                  aria-invalid={none || undefined} aria-describedby={none ? "cmpSlotMsg" + i : undefined}
                  onChange={(e) => setSlots(slots.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)))}>
                  {i === 2 ? <option value="">None</option> : null}
                  {names.map((nm) => <option key={nm}>{nm}</option>)}
                </NativeSelect>
                <NativeSelect className="w-32 shrink-0" data-cmpmode={i} aria-label={"Scenario " + CMP_LETTERS[i] + " mode"} value={sl.mode}
                  onChange={(e) => {
                    const mode = e.target.value as CmpMode;
                    setSlots(slots.map((y, j) => (j === i ? { mode, name: savedNames(mode).includes(y.name) ? y.name : "" } : y)));
                  }}>
                  {CMP_MODES.map((m) => <option key={m} value={m}>{CMP_MODE_LABEL[m]}</option>)}
                </NativeSelect>
              </>}>
                {none ? <SlotError id={"cmpSlotMsg" + i}>No {CMP_MODE_LABEL[sl.mode]} scenarios saved yet.</SlotError>
                  : x.run ? reading(x)
                  : !sl.name ? <SlotHint>Optional: pick a third scenario.</SlotHint> : null}
              </SlotRow>
            );
          }) : null}
        </div>
      </Card>

      <Card id="cmpChartPanel" className="min-w-0 lg:col-span-2" hidden={!enough}>
        <CardHeader><CardTitle>Balance over time</CardTitle><CardDescription>in today&apos;s dollars</CardDescription></CardHeader>
        <MultiChart id="C" ariaLabel="Saved scenarios compared" maxX={Math.max(0, ...live.map((x) => x.run!.years)) || 1}
          series={live.map((x) => ({ name: x.name, color: MULTI_COLORS[x.i], pts: x.run!.pts }))}
          head={(y) => <b>Year {fmtNum(y)}</b>} />
        <Legend id="legendC" items={live.map((x) => [MULTI_COLORS[x.i], x.name + " · " + CMP_MODE_LABEL[x.mode]])} />
      </Card>

      <Card id="cmpOutPanel" className="col-span-full min-w-0" hidden={!enough}>
        <CardHeader><CardTitle>Results</CardTitle><CardAction><CsvButton table={outRef} label="Results" /></CardAction></CardHeader>
        {mixed ? (
          <Alert className="mx-4.5 w-auto max-sm:mx-4" role="note">
            <InfoIcon aria-hidden="true" />
            <AlertDescription>These scenarios come from different calculators, which report different results. A row lines up only
              between scenarios from the same calculator; the others show a dash.</AlertDescription>
          </Alert>
        ) : null}
        <div className="swipehint">Swipe the table sideways to see every column.</div>
        <div className="scroll">
          <table id="cmpOutTable" ref={outRef}>
            <thead>{live.length ? (
              <tr><th>Result</th>{live.map((x) => [
                <th key={x.i}>{swatch(x.i)}{head(x)}</th>,
                withDelta.has(x.i) ? <th key={"d" + x.i}>{CMP_LETTERS[x.i] + " − " + CMP_LETTERS[base.i]}</th> : null,
              ])}</tr>
            ) : null}</thead>
            <tbody>
              {labels.map((k) => (
                <tr key={k}><td className="whitespace-normal text-muted-foreground">{k}</td>
                  {live.map((x) => {
                    const v = valOf(x, k), d = withDelta.has(x.i) ? deltaOf(x, k) : null;
                    return [
                      <td key={x.i} className={v == null ? "text-muted-foreground" : undefined}>{cmpFmt(v, kinds[k])}</td>,
                      withDelta.has(x.i) ? (d ? <td key={"d" + x.i} className="font-semibold">{d.t}</td> : <td key={"d" + x.i} className="text-muted-foreground">{"—"}</td>) : null,
                    ];
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card id="cmpInPanel" className="col-span-full min-w-0" hidden={!enough}>
        <CardHeader><CardTitle>Inputs</CardTitle><CardDescription>Inputs that differ are marked with a dot and set in bold.</CardDescription><CardAction><CsvButton table={inRef} label="Inputs" /></CardAction></CardHeader>
        <div className="swipehint">Swipe the table sideways to see every column.</div>
        <div className="scroll">
          <table id="cmpInTable" ref={inRef}>
            <thead>{live.length ? <tr><th>Input</th>{live.map((x) => <th key={x.i}>{swatch(x.i)}{head(x)}</th>)}</tr> : null}</thead>
            <tbody>
              {ilabels.map((k) => {
                const cells = live.map((x) => x.run!.inp.find((r) => r[0] === k)?.[1] ?? null);
                // Differs: two scenarios that both have this input set it differently.
                const diff = new Set(cells.filter((c) => c != null)).size > 1;
                return (
                  <tr key={k}>
                    <td className={cn("whitespace-normal", diff ? "font-semibold text-foreground" : "text-muted-foreground")}>
                      {diff ? <i className="mr-2 inline-block size-1.5 rounded-full bg-foreground align-middle" aria-hidden="true"></i> : null}{k}
                    </td>
                    {cells.map((c, j) => <td key={j} className={c == null ? "text-muted-foreground" : diff ? "font-semibold" : undefined}>{c ?? "—"}</td>)}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
