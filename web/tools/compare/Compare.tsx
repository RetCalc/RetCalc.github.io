"use client";

/* Up to three saved retirement scenarios side by side: their balances on
   one chart, every result with its difference from the first, and their
   inputs with the differences highlighted. From src/js/app/05-compare.js
   and src/main/04-compare.html. */

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Legend } from "@/components/charts/Legend";
import { MULTI_COLORS, MultiChart } from "@/components/charts/MultiChart";
import { useHousehold } from "@/components/household/HouseholdProvider";
import { CsvButton } from "@/components/ui/CsvButton";
import { fmtNum } from "@/lib/format";
import { compareNav } from "@/lib/compare-nav";
import { useClient } from "@/lib/useClient";
import { DDCompare } from "./DDCompare";
import { setNavDir } from "@/lib/nav-motion";
import {
  CMP_LETTERS, CMP_MODES, CMP_MODE_LABEL, cmpDelta, cmpFmt, cmpRun, openingSlots, rememberSlots, savedNames,
  type CmpMode, type Slot,
} from "./model";

const HELP = "Comparison reads saved scenarios only, exactly as they were saved. Nothing here changes the numbers on the Basic, Advanced or Stages tabs.";

/* Saved scenarios live in this browser, so the page fills in once it's here. */
export function Compare() {
  if (!useClient()) return <div className="stack" id="tab-compare" />;
  // opened from the Drawdown Simulator, it compares that tool's scenarios
  return compareNav.from === "drawdown" ? <DDCompare /> : <CompareSaved />;
}

function CompareSaved() {
  const router = useRouter();
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

  /* results, with a difference column against the first scenario */
  const labels: string[] = [], kinds: Record<string, Parameters<typeof cmpFmt>[1]> = {};
  live.forEach((x) => x.run!.out.forEach((r) => {
    if (!labels.includes(r.k)) {
      labels.push(r.k);
      kinds[r.k] = r.kind;
    }
  }));
  const valOf = (x: (typeof live)[number], k: string) => x.run!.out.find((r) => r.k === k)?.n ?? null;
  const ilabels: string[] = [];
  live.forEach((x) => x.run!.inp.forEach(([k]) => { if (!ilabels.includes(k)) ilabels.push(k); }));
  const head = (x: (typeof live)[number]) => CMP_LETTERS[x.i] + " · " + x.name;

  return (
    <div className="stack" id="tab-compare">
      <div className="panel">
        <h2>Compare scenarios<span className="h2ctrl"><button className="btn" type="button" id="cmpBack" onClick={() => { setNavDir("back"); router.push(compareNav.path); }}>Back</button></span></h2>
        <div className="body">
          <div className="hint" id="cmpEmpty" hidden={enough}>{enough ? null : <>You have {total ? "one saved scenario" : "no saved scenarios"}. Compare needs at least two: set up a plan on Basic, Advanced or Stages, save it with Save/Delete in the bar above, then change it and save again.</>}</div>
          <div className="cmpgrid" id="cmpPickers">
            {enough ? slots.map((sl, i) => (
              <div className="cmpslot" key={i}>
                <div className="cmpkey"><i style={{ background: MULTI_COLORS[i] }}></i>{CMP_LETTERS[i]}</div>
                <div className="field">
                  <select data-cmp={i} aria-label={"Scenario " + CMP_LETTERS[i]} value={sl.name}
                    onChange={(e) => setSlots(slots.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}>
                    {i === 2 ? <option value="">None</option> : null}
                    {savedNames(sl.mode).map((nm) => <option key={nm}>{nm}</option>)}
                  </select>
                </div>
                <div className="field">
                  <select data-cmpmode={i} aria-label={"Scenario " + CMP_LETTERS[i] + " mode"} value={sl.mode}
                    onChange={(e) => {
                      const mode = e.target.value as CmpMode;
                      setSlots(slots.map((x, j) => (j === i ? { mode, name: savedNames(mode).includes(x.name) ? x.name : "" } : x)));
                    }}>
                    {CMP_MODES.map((m) => <option key={m} value={m}>{CMP_MODE_LABEL[m]}</option>)}
                  </select>
                </div>
              </div>
            )) : null}
          </div>
          <div className="hint" id="cmpHelp" style={{ marginTop: "12px" }} hidden={!enough}>
            {HELP}
            {blank.length ? <>{" "}<b>{blank.map((x) => x.name + " has nothing saved for " + CMP_MODE_LABEL[x.mode]).join("; ") + "."}</b></> : null}
          </div>
        </div>
      </div>

      <div className="panel" id="cmpChartPanel" hidden={!enough}>
        <h2>Balance over time<span className="h2note">in today&apos;s dollars</span></h2>
        <MultiChart id="C" ariaLabel="Saved scenarios compared" maxX={Math.max(0, ...live.map((x) => x.run!.years)) || 1}
          series={live.map((x) => ({ name: x.name, color: MULTI_COLORS[x.i], pts: x.run!.pts }))}
          head={(y) => <b>Year {fmtNum(y)}</b>} />
        <Legend id="legendC" items={live.map((x) => [MULTI_COLORS[x.i], x.name + " · " + CMP_MODE_LABEL[x.mode]])} />
      </div>

      <div className="panel" id="cmpOutPanel" hidden={!enough}>
        <h2>Results<span className="h2ctrl"><CsvButton table={outRef} label="Results" /></span></h2>
        <div className="swipehint">Swipe the table sideways to see every column.</div>
        <div className="scroll">
          <table id="cmpOutTable" ref={outRef}>
            <thead>{live.length ? (
              <tr><th>Result</th>{live.map((x) => <th key={x.i}>{head(x)}</th>)}
                {live.slice(1).map((x) => <th key={"d" + x.i}>{CMP_LETTERS[x.i] + " − " + CMP_LETTERS[live[0].i]}</th>)}</tr>
            ) : null}</thead>
            <tbody>
              {labels.map((k) => (
                <tr key={k}><td>{k}</td>
                  {live.map((x) => {
                    const v = valOf(x, k);
                    return <td key={x.i} className={v == null ? "cmpna" : undefined}>{cmpFmt(v, kinds[k])}</td>;
                  })}
                  {live.slice(1).map((x) => {
                    const d = cmpDelta(valOf(live[0], k), valOf(x, k), kinds[k]);
                    return d ? <td key={"d" + x.i} className={d.cls || undefined}>{d.t}</td> : <td key={"d" + x.i} className="cmpna">{"—"}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel" id="cmpInPanel" hidden={!enough}>
        <h2>Inputs<span className="h2note">differences highlighted</span><span className="h2ctrl"><CsvButton table={inRef} label="Inputs" /></span></h2>
        <div className="swipehint">Swipe the table sideways to see every column.</div>
        <div className="scroll">
          <table id="cmpInTable" ref={inRef}>
            <thead>{live.length ? <tr><th>Input</th>{live.map((x) => <th key={x.i}>{head(x)}</th>)}</tr> : null}</thead>
            <tbody>
              {ilabels.map((k) => {
                const cells = live.map((x) => x.run!.inp.find((r) => r[0] === k)?.[1] ?? null);
                const diff = new Set(cells.map(String)).size > 1;
                return (
                  <tr key={k} className={diff ? "cmpdiff" : undefined}><td>{k}</td>
                    {cells.map((c, j) => <td key={j} className={c == null ? "cmpna" : undefined}>{c ?? "—"}</td>)}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
