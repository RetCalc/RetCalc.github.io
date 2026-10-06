"use client";

/* The Early Retirement Bridge: the years between an early retirement and
   59½, when a 401(k) or IRA opens up without the 10% additional tax. Every
   route the tax code allows runs as its own plan, tested against every
   historical market since 1926 (or random draws from it). Ported from
   src/js/app/36-bridge.js, src/main/11-bridge-inputs.html and 14-bridge.html. */

import { useDeferredValue, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BandChart } from "@/components/charts/BandChart";
import { HistLegend, Legend } from "@/components/charts/Legend";
import { MultiChart, type Series } from "@/components/charts/MultiChart";
import { StackedBars } from "@/components/charts/StackedBars";
import { FanTipRows, TipRow } from "@/components/charts/TipRows";
import { useHouseholdFill } from "@/components/household/HouseholdProvider";
import { Affixed, Field, FieldHeading, MoneyField, NumberField, SelectField } from "@/components/fields/Field";
import { MoneyInput } from "@/components/fields/NumberInput";
import { useToast } from "@/components/shell/Toast";
import { TipDot, Tipped } from "@/components/shell/Tooltips";
import { useToolState } from "@/components/tools/ToolState";
import { CsvButton } from "@/components/ui/CsvButton";
import { Figure, Segmented } from "@/components/ui/Readout";
import { HIST_START, LTCG_2026, STATES } from "@/lib/engine/typed";
import { BR_CATS, BR_NOEXP, BR_TRIALS, brSeppBase, brSeppEnd, brSeppMax } from "@/lib/engine/typed-bridge";
import type { BrCtx, BrEnd, BrRow } from "@/lib/engine/types";
import { useMcSeed } from "@/lib/mc-seed";
import { DASH, dollarsField, fmtNum, money, parseNum, pctStr } from "@/lib/format";
import { STATE_OPTIONS } from "@/lib/states";
import { sendToDrawdown } from "@/tools/drawdown/fields";
import { sendYearToTax } from "@/tools/tax/handoff";
import { BRIDGE_DEF, FILLS, bridgeAge, bridgeInput, type BridgeInputs } from "./model";
import { UNLOCK, bridgeScenarios, holdPct, lowerName, firstYearAfter, runBridge, type BridgeRun, type PathKey, type RunPlan, type Scenarios } from "./run";
import { useShareKit } from "@/components/shell/share";
import { bridgeShare } from "./share";
import { useBusy } from "@/lib/busy";

const stateName = (code: string) => (STATES as Record<string, { n: string }>)[code]?.n || code;
const holdCls = (v: number) => (v >= 0.95 ? "pos" : v >= 0.8 ? "gold" : "neg");
const PATHS = [["above", "Above average"], ["avg", "Average"], ["below", "Below average"]] as const;

export function Bridge() {
  const { state: s, set, setState } = useToolState(BRIDGE_DEF);
  const router = useRouter();
  const toast = useToast();
  const [mode, setMode] = useState<"hist" | "mc">("hist");
  const [selKey, setSelKey] = useState<string | null>(null);
  const [pathKey, setPath] = useState<PathKey>("avg");
  const [balView, setBalView] = useState<"acct" | "hist">("acct");
  const [tracesOn, setTracesOn] = useState(true);
  const compareRef = useRef<HTMLTableElement>(null), ladderRef = useRef<HTMLTableElement>(null), tableRef = useRef<HTMLTableElement>(null);

  useHouseholdFill("bridge", (h) => setState((c) => {
    const married = h.status === "m";
    const retire = h.retire != null && h.retire > 0 && h.retire < 120 ? Math.round(h.retire) : null;
    const next: BridgeInputs = { ...c, status: married ? "m" : "s" };
    if (retire && retire >= 30 && retire < 60) next.age = String(retire);
    if (!married || parseNum(c.household) <= 2) next.household = married ? "2" : "1";
    if (h.state && STATE_OPTIONS.some((o) => o.code === h.state)) next.state = h.state;
    if (h.spend != null && h.spend > 0) next.spend = dollarsField(h.spend);
    return next;
  }));

  // A couple is at least two people for the poverty line.
  const setStatus = (v: string) => setState((c) => {
    const hh = parseNum(c.household);
    return { ...c, status: v, household: v === "m" && hh < 2 ? "2" : v === "s" && hh === 2 ? "1" : c.household };
  });
  const setAca = (v: string) => setState((c) => ({ ...c, aca: v, fill: v !== "1" && c.fill === "aca" ? "auto" : c.fill }));

  /* Every plan runs against every market, so typing stays ahead of it: the
     inputs update at once and the results catch up. */
  const typed = useDeferredValue(s);
  useBusy(typed !== s);
  const seed = useMcSeed();
  const { ctx, run: R } = useMemo(() => runBridge(bridgeInput(typed), mode, seed), [typed, mode, seed]);
  const sel = R ? R.live.find((p) => p.key === selKey) ?? R.best : null;
  useShareKit(BRIDGE_DEF.id, bridgeShare(R, sel));
  const S = useMemo(() => (R && sel ? bridgeScenarios(R.ctx, sel) : null), [R, sel]);
  const path: PathKey = S && !S[pathKey] ? "avg" : pathKey;

  const aca = s.aca === "1";
  const seppMax = brSeppMax(ctx);

  /* ---- hand-offs: both follow the highlighted column ---- */
  const handoff = () => {
    if (!R || !S) {
      toast("Enter your balances first");
      return null;
    }
    const e = S[path]!.run.end;
    if (!(e.total > 0)) {
      toast("Nothing left at 59½ to hand over");
      return null;
    }
    return { ctx: R.ctx, e, y: firstYearAfter(R.ctx, e) };
  };
  const toDrawdown = () => {
    const H = handoff();
    if (!H) return;
    sendToDrawdown({
      initial: Math.round(H.e.total), retireAge: "60", stock: Math.round(H.ctx.stock), stockEnd: "", strategy: "fixed",
      rate: Math.max(0.1, Math.round(H.y.gross / H.e.total * 10000) / 100), spendFloor: 0, spendCeil: 0,
    });
    router.push("/drawdown");
    toast("Drawdown set to " + money(H.e.total) + " at 60, withdrawing " + money(H.y.gross) + " a year");
  };
  const toTax = () => {
    const H = handoff();
    if (!H) return;
    sendYearToTax({ status: H.ctx.status, state: H.ctx.state, trad: H.y.trad, roth: H.y.roth, brok: H.y.brok, gainShare: H.y.gainPct, seniors: 0 });
    router.push("/incometax");
    toast("Loaded a year of withdrawals at 60 into Income Tax");
  };

  const P = S ? S[path]! : null;
  const rows = P?.run.rows ?? [];

  return (
    <>
      <aside id="asideBR">
        <div className="panel inputs">
          <h2>Your situation</h2>
          <div className="body">
            <div className="two">
              <NumberField id="brAge" label={<Tipped text="Retire at" k="brage" />} unit="age" max={59} value={s.age} onValueChange={set("age")} />
              <SelectField id="brStatus" label="Filing status" value={s.status} onChange={setStatus}>
                <option value="m">Married filing jointly</option>
                <option value="s">Single</option>
              </SelectField>
            </div>
            <SelectField id="brState" label="State" value={s.state} onChange={set("state")}>
              {STATE_OPTIONS.map((o) => <option key={o.code} value={o.code}>{o.name}</option>)}
            </SelectField>
            <Field id="brSpend" label={<Tipped text="Yearly spending, after tax" k="brspend" />}>
              <Affixed prefix="$" suffix="/yr"><MoneyInput id="brSpend" nonNeg value={s.spend} onValueChange={set("spend")} /></Affixed>
              <div className="hint" id="brSpendNote">{aca ? "Leave out health insurance: each plan adds the premium its income level earns." : ""}</div>
            </Field>

            <FieldHeading top="8px">Your accounts at retirement</FieldHeading>
            <MoneyField id="brTrad" label={<Tipped text="Traditional 401(k) / IRA" k="brtrad" />} value={s.trad} onValueChange={set("trad")} />
            <MoneyField id="brK401" wrapId="brK401Wrap" hidden={bridgeAge(s) < 55} label={<Tipped text="Of that, in the 401(k) you're leaving" k="brk401" />} value={s.k401} onValueChange={set("k401")} />
            <div className="two">
              <MoneyField id="brRoth" label="Roth 401(k) / IRA" value={s.roth} onValueChange={set("roth")} />
              <MoneyField id="brRothBasis" label={<Tipped text="Of that, contributions" k="brrothbasis" />} value={s.rothBasis} onValueChange={set("rothBasis")} />
            </div>
            <div className="two">
              <MoneyField id="brBrok" label="Brokerage and cash" value={s.brok} onValueChange={set("brok")} />
              <NumberField id="brBasis" label={<Tipped text="Cost basis" k="brbasis" />} unit="% of balance" step={5} max={100} value={s.basis} onValueChange={set("basis")} />
            </div>
            <div className="two">
              <MoneyField id="brG457" label={<Tipped text="Governmental 457(b)" k="br457" />} value={s.g457} onValueChange={set("g457")} />
              <NumberField id="brStock" label={<Tipped text="Stocks" k="brstock" />} unit="%" step={5} max={100} value={s.stock} onValueChange={set("stock")} />
            </div>

            <FieldHeading top="8px">Income</FieldHeading>
            <div className="two">
              <MoneyField id="brWork" label={<>Part-time work <span className="opt">optional</span></>} unit="/yr" value={s.work} onValueChange={set("work")} />
              <NumberField id="brWorkUntil" label="Until" unit="age" max={80} value={s.workUntil} onValueChange={set("workUntil")} />
            </div>

            <FieldHeading top="8px">Health insurance</FieldHeading>
            <SelectField id="brAca" label={<Tipped text="Premiums" k="braca" />} value={s.aca} onChange={setAca}>
              <option value="1">ACA plan, with the subsidy your income earns</option>
              <option value="0">Leave health insurance out</option>
            </SelectField>
            <div className="two" id="brAcaWrap" hidden={!aca}>
              <NumberField id="brHousehold" label="Household size" unit="people" max={10} value={s.household} onValueChange={set("household")} />
              <Field id="brPremium" label={<>Benchmark premium <span className="tipglue"><span className="opt">optional</span><TipDot k="brpremium" /></span></>}>
                <Affixed prefix="$" suffix="/mo"><MoneyInput id="brPremium" nonNeg placeholder="estimate" value={s.premium} onValueChange={set("premium")} /></Affixed>
              </Field>
            </div>

            <FieldHeading top="8px">How the plans work</FieldHeading>
            <SelectField id="brFill" label={<Tipped text="Blended plan converts" k="brfill" />} value={s.fill} onChange={set("fill")}>
              {FILLS.map(([v, label]) => <option key={v} value={v} disabled={v === "aca" && !aca}>{label}</option>)}
            </SelectField>
            <div className="two">
              <SelectField id="brSeppMethod" label={<Tipped text="72(t) method" k="brseppmethod" />} value={s.seppMethod} onChange={set("seppMethod")}>
                <option value="amort">Amortization</option>
                <option value="rmd">RMD</option>
              </SelectField>
              <NumberField id="brSeppRate" label={<Tipped text="72(t) interest rate" k="brsepprate" />} unit="%" step={0.25} max={12} value={s.seppRate} onValueChange={set("seppRate")} />
            </div>

            <div className="derived">
              <div><span>Locked until 59½</span><span className="num" id="brLockYears">
                {fmtNum(ctx.nB) + (ctx.nB === 1 ? " year" : " years") + ", ages " + fmtNum(ctx.age) + (ctx.nB > 1 ? "–" + fmtNum(ctx.age + ctx.nB - 1) : "")}
              </span></div>
              <div><span><Tipped text="Rule of 55" k="brk401" /></span><span className="num" id="brR55State">
                {!(ctx.k401 > 0) ? "No 401(k) entered" : ctx.r55 ? "Eligible" : "Not until " + ctx.r55Age}
              </span></div>
              <div><span>Most 72(t) could pay</span><span className="num" id="brSeppMax">{seppMax > 0 ? money(seppMax) + "/yr" : DASH}</span></div>
              <div><span><Tipped text="Average return, this mix" k="brsteady" /></span><span className="num" id="brSteadyRet">{pctStr(ctx.real, 1) + " real"}</span></div>
            </div>
          </div>
        </div>
      </aside>

      <div className="stack" id="tab-bridge">
        <Headline R={R} />

        <div className="panel">
          <h2>Ways to 59½<span className="h2note">click one to see it year by year</span>
            <span className="h2ctrl">
              <Segmented id="segBR" attr="data-brmode" options={[["hist", "Historical"], ["mc", "Monte Carlo"]] as const} value={mode} onChange={setMode} />
              <CsvButton table={compareRef} label="Ways to 59½" />
            </span>
          </h2>
          <div className="swipehint">Swipe the table sideways to see every column.</div>
          <div className="scroll" style={{ maxHeight: "none" }}>
            <table id="brCompare" ref={compareRef}>
              <thead><tr><th>Plan</th><th>Holds to 59½</th><th>Tax</th><th>Penalties</th><th>Health premiums</th><th>At 59½</th></tr></thead>
              <tbody>{R && sel ? <CompareRows R={R} sel={sel} onPick={setSelKey} /> : null}</tbody>
            </table>
          </div>
          <div className="hint" id="brCompareNote" style={{ padding: "0 18px 14px" }}>
            {R ? "Success rates " + (R.mc ? "come from " + BR_TRIALS + " random sequences of historical years" : "come from every start year since " + HIST_START) +
              ". Tax, penalties, premiums and the balance at 59½ are the steady path at the long-run average return of " +
              pctStr(R.ctx.real, 1) + " real. “Holds” means reaching 59½ without running short or touching penalized money the plan didn't intend to." : ""}
          </div>
        </div>

        <div className="panel">
          <h2 id="brAtTitle">{sel ? "What you'll have at 59½, " + lowerName(sel.name) : "What you'll have at 59½"}<span className="h2note">today&apos;s dollars</span>
            <span className="h2ctrl">
              <Segmented id="segBRPath" attr="data-brpath" options={PATHS} value={path} onChange={setPath} disabled={S ? (k) => !S[k] : undefined} />
            </span>
          </h2>
          <div className="body">
            <div id="brAtOut">{R && S ? <AtTable ctx={R.ctx} S={S} path={path} /> : null}</div>
            <div className="br-send">
              <button className="btn" type="button" id="brToDD" onClick={toDrawdown}>Send to Drawdown Simulator</button>{" "}
              <button className="btn" type="button" id="brToTax" onClick={toTax}>Send to Income Tax</button>{" "}
              <TipDot k="brhandoff" title="Sending this to another tool" />
            </div>
          </div>
        </div>

        <div className="panel">
          <h2 id="brFlowTitle">{P ? "Where each year's money comes from, " + P.label : "Where each year's money comes from"}<span className="h2note">today&apos;s dollars</span></h2>
          <FlowChart rows={rows} aca={!!R?.ctx.aca} />
          <div className="hint" id="brFlowNote" style={{ padding: "0 18px 14px" }}>{R && P ? <FlowNotes ctx={R.ctx} P={P.run} rows={rows} /> : null}</div>
        </div>

        <div className="panel">
          <h2 id="brBalTitle">{balView === "hist" ? "Total balance, every start since " + HIST_START : P ? "Account balances, " + P.label : "Account balances"}<span className="h2note">today&apos;s dollars</span>
            <span className="h2ctrl">
              <Segmented id="segBRBal" attr="data-brbal" options={[["acct", "By account"], ["hist", "Across history"]] as const} value={balView} onChange={setBalView} />
            </span>
          </h2>
          {balView === "hist" ? (
            <>
              <HistFan ctx={ctx} sel={R ? sel : null} tracesOn={tracesOn} />
              {R ? <HistLegend id="legendBRB" tracesOn={tracesOn} onToggleTraces={() => setTracesOn((v) => !v)} /> : <Legend id="legendBRB" items={[]} />}
            </>
          ) : (
            <Balances ctx={ctx} rows={R ? rows : []} />
          )}
        </div>

        <Ladder rows={rows} ctx={ctx} tableRef={ladderRef} />

        <div className="panel">
          <h2 id="brTableTitle">{sel && P ? "Year by year, " + lowerName(sel.name) + ", " + P.label : "Year by year"}<span className="h2ctrl"><CsvButton table={tableRef} label="Year by year" /></span></h2>
          <div className="swipehint">Swipe the table sideways to see every column.</div>
          <div className="scroll">
            <table id="brTable" ref={tableRef}>
              <thead><tr><th>Age</th><th>Spending</th><th>Health</th><th>Tax</th><th>Penalty</th><th>Brokerage</th><th>Roth</th><th>72(t)</th><th>55 / 457(b)</th><th>Penalized</th><th>Work</th><th>Converted</th><th>MAGI</th><th>Balance</th></tr></thead>
              <tbody>{R ? <YearRows rows={rows} ctx={R.ctx} /> : null}</tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <h2>The rules that shape this</h2>
          <div className="body"><dl className="gloss" id="brRules">{R ? <Rules ctx={R.ctx} /> : null}</dl></div>
        </div>
      </div>
    </>
  );
}

/* ---- results ---- */

function Headline({ R }: { R: BridgeRun | null }) {
  if (!R) {
    return (
      <div className="panel">
        <div className="headline">
          <Figure label="Best way to 59½" id="brBest" className="v gold" sized={false} value={DASH} noteId="brBestNote" note="" />
          <Figure label={<Tipped text="Holds up in" k="brholds" />} id="brHold" className="v" sized={false} value={DASH} noteId="brHoldNote" note="" />
          <Figure label={<Tipped text="Cost of the bridge" k="brcost" />} id="brCost" className="v" sized={false} value={DASH} noteId="brCostNote" note="" />
        </div>
        <div className="body"><div id="brVerdict"><div className="hint" style={{ margin: 0 }}>Enter your spending and at least one account balance to plan the bridge.</div></div></div>
      </div>
    );
  }
  const { ctx, best: b } = R, t = b.test, st = b.steady, h = t.hold / Math.max(1, t.of);
  const ages = ctx.age + (ctx.nB > 1 ? "–" + (ctx.age + ctx.nB - 1) : "");
  const pen = R.plans.find((p) => p.key === "pen");
  return (
    <div className="panel">
      <div className="headline">
        <Figure label="Best way to 59½" id="brBest" className="v gold" value={b.name} noteId="brBestNote" note={b.desc} />
        <Figure label={<Tipped text="Holds up in" k="brholds" />} id="brHold" className={"v " + (h >= 0.95 ? "jade" : h >= 0.8 ? "gold" : "neg")} value={pctStr(h, 0)} noteId="brHoldNote"
          note={R.mc ? "of " + t.of + " random markets reach 59½ penalty-free" : "of " + t.of + " retirements since " + HIST_START + " reach 59½ penalty-free"} />
        <Figure label={<Tipped text="Cost of the bridge" k="brcost" />} id="brCost" className="v" value={money(st.cost)} noteId="brCostNote"
          note={"Tax, penalties" + (ctx.aca ? " and health premiums" : "") + ", ages " + ages} />
      </div>
      <div className="body"><div id="brVerdict">
        <div className="hint" style={{ margin: 0, fontSize: "13px", lineHeight: 1.6 }}>
          With <b>{b.phrase}</b>, you reach 59½ without an unplanned penalty or running short in <b>{pctStr(h, 0)}</b> of the{" "}
          {R.mc ? t.of + " random markets drawn from the record" : t.of + " historical starts since " + HIST_START}.{" "}
          On the steady path you arrive with <b>{money(st.end.total)}</b>: {money(st.end.trad)} traditional, {money(st.end.roth)} Roth and {money(st.end.brok)} in the brokerage.
          {b.key !== "pen" && pen?.steady && pen.steady.cost > st.cost + 1 ? (
            <> That&apos;s <b>{money(pen.steady.cost - st.cost)}</b> less in tax, penalties{ctx.aca ? " and premiums" : ""} than simply paying the penalty.</>
          ) : null}
        </div>
      </div></div>
    </div>
  );
}

function CompareRows({ R, sel, onPick }: { R: BridgeRun; sel: RunPlan; onPick: (key: string) => void }) {
  return (
    <>
      {R.plans.map((p) => {
        const name = (
          <td>
            <span className="br-name">{p.name}{p.key === R.best.key ? <span className="br-tag">Best</span> : null}</span>
            <span className="br-desc">{p.off || p.desc || ""}</span>
          </td>
        );
        if (p.off || !p.test || !p.steady) return <tr key={p.key} className="br-off">{name}<td colSpan={5}>{DASH}</td></tr>;
        const t = p.test, st = p.steady;
        return (
          <tr key={p.key} className={"ddrow" + (p.key === sel.key ? " sel" : "")} data-plan={p.key} tabIndex={0}
            onClick={() => onPick(p.key)}
            onKeyDown={(e) => {
              if (e.key !== "Enter" && e.key !== " ") return;
              e.preventDefault();
              onPick(p.key);
            }}>
            {name}
            {p.penaltyPlanned
              ? <td title="Counts only running short, since the penalty is the plan">{holdPct(t.hold, t.of)}</td>
              : <td className={holdCls(t.hold / Math.max(1, t.of))}>{holdPct(t.hold, t.of)}</td>}
            <td>{money(st.tax)}</td>
            <td className={st.pen > 0.5 ? "neg" : undefined}>{money(st.pen)}</td>
            <td>{R.ctx.aca ? money(st.health) : DASH}</td>
            <td>{money(st.end.total)}</td>
          </tr>
        );
      })}
    </>
  );
}

/* The payoff: each account at 59½ in an above-average, an average and a
   below-average market, side by side. The highlighted column is the one the
   charts, table and hand-offs below follow. */
function AtTable({ ctx, S, path }: { ctx: BrCtx; S: Scenarios; path: PathKey }) {
  const keys = (["above", "avg", "below"] as const).filter((k) => S[k]);
  const on = (k: PathKey) => (k === path ? "on" : undefined);
  const line = (label: string, f: (x: BrEnd) => number, cls?: string) => (
    <tr className={cls}><td>{label}</td>{keys.map((k) => <td key={k} className={on(k)}>{money(f(S[k]!.run.end))}</td>)}</tr>
  );
  const short = keys.filter((k) => !S[k]!.run.ok);
  const seppEnd = brSeppEnd(ctx), e = S[path]!.run.end;
  const notes = [
    e.sepp > 0.5 && seppEnd > 59 ? money(e.sepp) + " of the traditional balance is still paying 72(t) through age " + seppEnd + "." : null,
    e.rothIn > 0.5 ? money(e.rothIn) + " of the Roth is contributions and conversions." : null,
    e.brok > 0.5 ? pctStr(1 - e.bBasis / e.brok, 0) + " of the brokerage is growth." : null,
  ].filter(Boolean).join(" ");
  return (
    <>
      <div className="scroll" style={{ maxHeight: "none" }}>
        <table id="brAtTable">
          <thead><tr><th>Account</th>{keys.map((k) => (
            <th key={k} className={on(k)}>{S[k]!.head}{S[k]!.year ? <span className="br-yr">{S[k]!.pct + ", " + S[k]!.year}</span> : null}</th>
          ))}</tr></thead>
          <tbody>
            {line("Traditional 401(k) / IRA", (x) => x.ira + x.sepp)}
            {ctx.g457 > 0 ? line("457(b)", (x) => x.g457) : null}
            {line("Roth", (x) => x.roth)}
            {line("Brokerage", (x) => x.brok)}
            {line("Total at 59½", (x) => x.total, "br-tot")}
          </tbody>
        </table>
      </div>
      {notes || short.length ? (
        <div className="hint" style={{ marginTop: "10px" }}>
          {notes}
          {short.length ? (
            <>{notes ? " " : ""}<b className="neg">In the {short.map((k) => S[k]!.head.toLowerCase()).join(" and ")} case{short.length > 1 ? "s" : ""}, this plan runs short or needs penalized money before 59{"½"}.</b></>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

/* Where each year's spending comes from: one bar per age, split by source,
   with the year's Roth conversion as a tick. Only what gets spent counts: a
   72(t) payment beyond the year's needs is reinvested. */
function FlowChart({ rows, aca }: { rows: BrRow[]; aca: boolean }) {
  const bars = rows.map((r) => {
    const d = r.d, parts: Record<string, number> = { work: r.W, brok: d.brok, rothBasis: d.rothBasis, rung: d.rung, sepp: r.sp, r55: d.r55, early: d.early };
    let extra = r.surplus;
    for (const k of ["sepp", "r55", "work"]) {
      const t = Math.min(extra, parts[k]);
      parts[k] -= t;
      extra -= t;
    }
    return { label: r.age, parts, tick: r.C, row: r };
  });
  const used = BR_CATS.filter((c) => bars.some((b) => b.parts[c.k] > 0.5));
  const conv = bars.some((b) => b.tick > 0.5);
  return (
    <>
      <StackedBars id="BR" bars={bars} cats={BR_CATS} ariaLabel="Where each year's spending comes from"
        tip={(i) => {
          const b = bars[i], r = b.row;
          return (
            <>
              <b>Age {b.label}</b>
              {BR_CATS.filter((c) => b.parts[c.k] > 0.5).map((c) => <TipRow key={c.k} color={c.c} label={c.name} value={b.parts[c.k]} />)}
              {b.tick > 0.5 ? <><br />Converted <span className="n">{money(b.tick)}</span></> : null}
              <br /><span style={{ color: "var(--dim)" }}>{"Tax " + money(r.tax + r.fica) + (r.pen > 0.5 ? " · penalty " + money(r.pen) : "") + (aca ? " · health " + money(r.health) : "")}</span>
              {r.surplus > 50 ? <><br /><span style={{ color: "var(--dim)" }}>Reinvested {money(r.surplus)}</span></> : null}
            </>
          );
        }} />
      <Legend id="legendBR" items={used.map((c) => [c.c, c.name])}>
        {conv ? <span><i style={{ background: "transparent", border: "2px solid var(--text)", height: "2px", marginTop: "4px" }}></i>Converted to Roth, not spent</span> : null}
      </Legend>
    </>
  );
}

function FlowNotes({ ctx, P, rows }: { ctx: BrCtx; P: { medicaid: number; cliff: number; gap: number }; rows: BrRow[] }) {
  const yrs = (n: number) => n + (n === 1 ? " year" : " years");
  const notes: string[] = [];
  if (P.medicaid > 0) notes.push("In " + yrs(P.medicaid) + " income is low enough for Medicaid in " + stateName(ctx.state) + ", so no premium is counted.");
  if (P.cliff > 0) notes.push("In " + yrs(P.cliff) + " income is over the ACA cliff, so the full premium is paid.");
  if (P.gap > 0) notes.push("In " + yrs(P.gap) + " income falls below the poverty line in a state without expanded Medicaid, so there is no subsidy.");
  const sh = rows.find((r) => r.short > 1);
  return (
    <>
      {notes.join(" ")}
      {sh ? <>{notes.length ? " " : ""}<b className="neg">Runs short at {sh.age}</b>: the accounts this plan can reach can&apos;t cover that year.</> : null}
    </>
  );
}

/* Each account's balance by age, on the market the column above picks. */
function Balances({ ctx, rows }: { ctx: BrCtx; rows: BrRow[] }) {
  const S0 = { trad: ctx.trad + ctx.g457, roth: ctx.roth, brok: ctx.brok };
  const mk = (f: (e: BrRow["end"]) => number, start: number) => [{ year: 0, value: start }, ...rows.map((r, i) => ({ year: i + 1, value: f(r.end) }))];
  const series: Series[] = rows.length ? [
    { name: "Total", color: "#e9b872", pts: mk((e) => e.total, S0.trad + S0.roth + S0.brok), width: 2.6 },
    { name: "Traditional", color: "#e2795f", pts: mk((e) => e.trad, S0.trad) },
    { name: "Roth", color: "#4fbf95", pts: mk((e) => e.roth, S0.roth) },
    { name: "Brokerage", color: "#7d9fd6", pts: mk((e) => e.brok, S0.brok) },
  ] : [];
  return (
    <>
      <MultiChart id="BRB" series={series} maxX={rows.length} ariaLabel="Account balances by age" xFmt={(y) => ctx.age + y} head={(y) => <b>Age {ctx.age + y}</b>} />
      <Legend id="legendBRB" items={series.map((x) => [x.color!, x.name])} />
    </>
  );
}

/* Every historical start's total, year by year, as the same percentile fan
   the other tools use: where the plan's money went across all of them. */
function HistFan({ ctx, sel, tracesOn }: { ctx: BrCtx; sel: RunPlan | null; tracesOn: boolean }) {
  const runs = sel?.hist.runs ?? [], n = ctx.nB;
  const pts = runs.length ? Array.from({ length: n + 1 }, (_, y) => {
    const v = runs.map((r) => r.path[y]).sort((a, b) => a - b);
    const at = (q: number) => v[Math.min(v.length - 1, Math.floor(v.length * q))];
    return { year: y, base: at(0.5), hi: at(0.9), lo: at(0.1), p25: at(0.25), p75: at(0.75) };
  }) : [];
  return (
    <BandChart id="BRB" pts={pts} maxX={n} mode="mc" xOffset={ctx.age} enhanced ariaLabel="Account balances by age"
      traces={tracesOn && pts.length ? { xs: pts.map((a) => a.year), lines: runs.map((r) => Array.from(r.path.slice(0, n + 1))) } : undefined}
      tip={(b) => <><b>Age {ctx.age + b.year}</b><FanTipRows b={b} /></>} />
  );
}

function Ladder({ rows, ctx, tableRef }: { rows: BrRow[]; ctx: BrCtx; tableRef: React.RefObject<HTMLTableElement | null> }) {
  const conv = rows.filter((r) => r.C > 0.5);
  return (
    <div className="panel" id="brLadderPanel" hidden={!conv.length}>
      <h2>The conversion ladder<span className="h2note">each rung waits five years</span><span className="h2ctrl"><CsvButton table={tableRef} label="The conversion ladder" /></span></h2>
      <div className="scroll">
        <table id="brLadder" ref={tableRef}>
          <thead><tr><th>Converted at</th><th>Amount</th><th>Tax that year</th><th>Penalty-free from</th></tr></thead>
          <tbody>
            {conv.length && ctx.rothBasis > 0 ? <tr><td>Contributions</td><td>{money(ctx.rothBasis)}</td><td>{DASH}</td><td>Now</td></tr> : null}
            {conv.map((r) => (
              <tr key={r.age}><td>{r.age}</td><td>{money(r.C)}</td><td>{money(r.tax)}</td><td>{r.age + 5 >= UNLOCK ? "59½" : r.age + 5}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="hint" id="brLadderNote" style={{ padding: "0 18px 14px" }}>
        {conv.length ? "Converted before 59½: " + money(conv.reduce((a, r) => a + r.C, 0)) +
          ". A conversion's five-year clock starts on January 1 of the year you make it, so a " +
          "conversion made any time in 2026 is penalty-free from January 1, 2031. The tax column is " +
          "the whole year's tax, conversion included." : ""}
      </div>
    </div>
  );
}

function YearRows({ rows, ctx }: { rows: BrRow[]; ctx: BrCtx }) {
  const m = (v: number) => (v > 0.5 ? money(v) : DASH);
  return (
    <>
      {rows.map((r) => {
        const d = r.d;
        return (
          <tr key={r.age} style={r.short > 1 ? { color: "var(--coral)" } : undefined}>
            <td>{r.age}</td><td>{money(ctx.spend)}</td><td>{ctx.aca ? money(r.health) : DASH}</td><td>{money(r.tax + r.fica)}</td>
            <td>{m(r.pen)}</td><td>{m(d.brok)}</td><td>{m(d.rothBasis + d.rung)}</td><td>{m(r.sp)}</td><td>{m(d.r55)}</td>
            <td>{m(d.early)}</td><td>{m(r.W)}</td><td>{m(r.C)}</td>
            <td>{money(r.magi)}{r.fplPct != null ? <>{" "}<span className="br-fpl">{Math.round(r.fplPct * 100)}%</span></> : null}</td>
            <td>{money(r.end.total)}</td>
          </tr>
        );
      })}
    </>
  );
}

function Rules({ ctx }: { ctx: BrCtx }) {
  const stN = stateName(ctx.state), seppEnd = brSeppEnd(ctx);
  const ltcg = (LTCG_2026 as Record<string, number[]>)[ctx.status][0];
  const rules: [string, string][] = [
    ["The 10% before 59½", "Money out of a 401(k) or IRA before 59½ owes a 10% additional tax on " +
      "top of income tax (IRC §72(t)), unless an exception applies. The plans here are built out of " +
      "those exceptions." + (ctx.stateCA ? " California adds its own 2.5% on top." : "") +
      " This tool counts the year you turn 59 as locked, since 59½ falls partway through it."],
    ["Roth contributions", ctx.rothBasis > 0
      ? "Your " + money(ctx.rothBasis) + " of contributions can come out any time, tax- and penalty-free. " +
        "The IRS ordering rules take contributions first, then conversions oldest first, then earnings, " +
        "and earnings before 59½ are taxed and penalized."
      : "Contributions to a Roth can come out any time tax- and penalty-free; enter yours to use them."],
    ["Roth conversion ladder", "Each conversion is taxed as income the year you make it, then waits " +
      "five tax years before it can come out penalty-free. Converting from your first year of retirement " +
      "means the first five years" + (ctx.nB > 5 ? " (ages " + ctx.age + "–" + (ctx.age + 4) + ")" : "") +
      " have to come from somewhere else: the brokerage, Roth contributions or 72(t) payments. Converting " +
      "while still working starts the clocks sooner, but at your working tax rate."],
    ["72(t) payments", "Substantially equal periodic payments from an IRA are penalty-free at any age. " +
      "At " + ctx.age + ", the most " + money(brSeppBase(ctx)) + " could pay is " + money(brSeppMax(ctx, "amort")) +
      " a year by amortization at " + pctStr(ctx.seppRate, 2) + ", or " + money(brSeppMax(ctx, "rmd")) +
      " by the RMD method. Payments must run until age " + seppEnd + " (the later of five years or 59½)" +
      (seppEnd > 59 ? ", so they carry on past 59½" : "") + ". Changing them, adding money to that IRA or " +
      "taking anything extra puts the 10% back on every payment so far, plus interest. Splitting off a " +
      "smaller IRA first locks in only what you need, which is how the plans here size it. A one-time " +
      "switch from amortization to the RMD method is allowed."],
    ["Rule of 55", ctx.k401 > 0
      ? (ctx.r55 ? "Leaving your job at " + ctx.age + " opens the " + money(ctx.k401) + " 401(k) you're leaving to penalty-free withdrawals. "
        : "Retiring at " + ctx.age + " is too early: the rule needs you to leave in or after the year you turn " + ctx.r55Age + ". ") +
        "It covers only that employer's plan. Rolling it to an IRA loses it, and older 401(k)s and IRAs " +
        "don't qualify, though you can roll them into the current plan before you leave."
      : "Leaving a job in or after the year you turn 55 opens that employer's 401(k) penalty-free. Enter its balance to use it."],
  ];
  if (ctx.g457 > 0) rules.push(["457(b)", "A governmental 457(b) has no 10% penalty at all once you've left the " +
    "employer, whatever your age. Every plan here uses your " + money(ctx.g457) + " before anything penalized."]);
  if (ctx.aca) rules.push(["Health insurance and MAGI", "Your premium depends on MAGI: conversions, 401(k) and IRA " +
    "withdrawals, 72(t) payments and capital gains all count; Roth withdrawals and the cost basis of " +
    "what you sell don't. For a household of " + Math.max(ctx.household, ctx.adults) + ", the subsidy " +
    "disappears entirely above " + money(ctx.fpl * 4) + " (400% of the poverty line)" +
    (BR_NOEXP[ctx.state] ? ", and below " + money(ctx.fpl) + " " + stN + " offers no subsidy or Medicaid for most adults."
      : ", and below " + money(ctx.fpl * 1.38) + " (138%) " + stN + " covers adults through Medicaid instead.") +
    " The blended plan counts that cost when it picks how much to convert."]);
  rules.push(["0% capital gains", "Long-term gains are taxed at 0% while taxable income, gains included, stays under " +
    money(ltcg) + (ctx.status === "m" ? " for a joint return" : "") + ". With little " +
    "other income in early retirement, most brokerage sales land there, which is why living off a taxable " +
    "account is often nearly tax-free."]);
  return <>{rules.map(([t, d]) => [<dt key={t + "t"}>{t}</dt>, <dd key={t + "d"}>{d}</dd>])}</>;
}
