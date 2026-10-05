"use client";

/* The Drawdown Simulator's inputs: the portfolio and its mix, the
   retirement, the strategy and its settings, spending limits and path,
   Social Security, other income and expenses, goals, and how history is
   tested. From src/main/08-drawdown.html and the renderDrawdown(),
   ddPathSync(), ddFloorSync(), ddGuarSync() and ddMCSync() parts of
   src/js/app/15*.js. */

import { MON } from "@/components/charts/HistNotes";
import { Affixed, Field, MoneyField, NumberField, SelectField } from "@/components/fields/Field";
import { DraftInput } from "@/components/fields/DraftInput";
import { MoneyInput, NumberInput } from "@/components/fields/NumberInput";
import { useToast } from "@/components/shell/Toast";
import { TipDot, Tipped } from "@/components/shell/Tooltips";
import { StageHead } from "@/components/tools/StageHead";
import { Html } from "@/components/ui/Html";
import { DD_STRAT, ddMCHistory, ssDrawdownStreams, ssEstimate } from "@/lib/engine/typed-drawdown";
import { fmtNum, groupDigits, money, parseNum, pctStr } from "@/lib/format";
import { advInUse, fromClamp, type DdItem, type DrawdownState, type FloorStep, type PathStage } from "./fields";
import { Spark } from "./Spark";
import { DD_FAMILY, DD_UI, ageVal, ddN, hardStart, lineWords, mixText, rebalNote, spendThrough, stratNote } from "./text";
import type { DDView } from "./Drawdown";


/** Stages in the order they take effect, each with its working start year. */
export function wdOrder(list: PathStage[]) {
  return list.map((st, i) => ({ st, i, start: Math.max(2, Math.round(st.start || 0)) })).sort((a, b) => a.start - b.start || a.i - b.i);
}

export function Inputs({ v, fromNote, periods, open }: {
  v: DDView; fromNote: string; periods: string;
  open: (dialog: { kind: "mix" | "guide" | "study" } | { kind: "item"; list: "incomeItems" | "expenseItems"; index: number | null }) => void;
}) {
  const { s, set, setState, o, P, firstW, r1, age, mode, inputs, setInputs } = v;
  const toast = useToast();
  const strat = o.strategy, U = DD_UI[strat] || DD_UI.fixed, S = DD_STRAT[strat];
  const shown = (id: string) => U.blocks.includes(id);
  const str = (k: string) => s[k] as string;
  const num = (k: string) => parseNum(str(k));
  const ssMode = str("ssMode");
  const ssAgeMode = ssMode === "manual" && age != null;
  const ssCouple = ssMode !== "none" && str("ssWho") === "couple";
  const d = v.d;
  const nb = <T extends object>(k: "pathStages" | "floorSteps" | "incomeItems" | "expenseItems") => s[k] as unknown as T[];

  /* ---- notes the strategies write ---- */
  let vpwNote = "", yaleNote = "", guardExample = "";
  if (strat === "vpw") {
    const stk = o.stockPct + o.svPct, conv = (stk * 5.0 + (100 - stk) * 1.9) / 100;
    vpwNote = "Year 1 takes <b>" + pctStr(r1, 2) + "</b>, rising each year as the horizon shortens. Bogleheads suggests " +
      pctStr(conv / 100, 2) + " for a " + ddN(stk) + "/" + ddN(100 - stk) + " mix.";
  }
  if (strat === "yale")
    yaleNote = "Each year: <b>" + o.yaleWeight + "%</b> of last year's spending (adjusted for inflation) plus <b>" + (100 - o.yaleWeight) +
      "%</b> of <b>" + o.yaleRate + "%</b> of the current portfolio.";
  if (strat === "guardrails") {
    const t = o.initialPct, hiRate = t * (1 + Math.max(0, o.guardBand) / 100), loRate = t * (1 - Math.min(100, Math.max(0, o.guardBandLo)) / 100);
    guardExample = "With a " + pctStr(t / 100, 1) + " target: if your withdrawal ever climbs above <b>" + pctStr(hiRate / 100, 1) +
      "</b> of the portfolio, spending is cut " + fmtNum(Math.min(100, Math.max(0, o.adjustPct))) + "%" +
      (o.gkFinalYears > 0 ? (o.gkFinalYears >= o.years ? ", except that with no cuts in the final " + fmtNum(o.gkFinalYears) +
          " years, it never is in a " + fmtNum(o.years) + "-year plan"
        : " (but not in the final " + fmtNum(o.gkFinalYears) + " years)") : "") +
      ". If it falls below <b>" + pctStr(loRate / 100, 1) + "</b>, you get a " + fmtNum(Math.max(0, o.raisePct)) + "% raise.";
  }
  const note = stratNote(o, firstW, r1);
  const clash = S.limits !== false && o.spendFloor > 0 && o.spendCeil > 0 && o.spendFloor > o.spendCeil;

  /* ---- Social Security ---- */
  let ssEstNote = "";
  if (ssMode === "est") {
    if (ssCouple) {
      const st = ssDrawdownStreams(d.ssIncome as number, d.ssClaim as number, d.ssIncome2 as number, d.ssClaim2 as number, true, null, 0);
      const m1 = (st.own1 + st.top1) / 12, m2 = (st.own2 + st.top2) / 12;
      ssEstNote = "About " + money(m1) + "/mo for you and " + money(m2) + "/mo for your spouse, " + money(m1 + m2) + "/mo combined, in today's dollars" +
        (st.top1 + st.top2 > 0 ? ", including a spousal benefit of " + money((st.top1 + st.top2) / 12) + "/mo once you've both claimed" : "") + ".";
    } else {
      const e = ssEstimate(d.ssIncome as number, 40, Math.min(70, Math.max(62, d.ssClaim as number)));
      ssEstNote = "About " + money(e.monthly) + " a month in today's dollars, claiming at " + Math.round(d.ssClaim as number) + ".";
    }
  }

  /* ---- the strategy card: its family, blurb and spending through a hard start ---- */
  const w = o.initial > 0 ? hardStart(o) : null;
  let card: React.ReactNode = null;
  if (U && S) {
    let spark: React.ReactNode = null, cap = "";
    if (w) {
      const vals = spendThrough(o, w, P), hi = Math.max(...vals), lo = Math.min(...vals);
      spark = <Spark vals={vals} line={v.comfort} />;
      cap = "Spending, retiring in " + (w.month !== 1 ? MON[w.month - 1] + " " : "") + w.year + ": " +
        (Math.round(hi - lo) < 1 ? money(lo) + " every year" : money(vals[0]) + " in year one, " + money(lo) + " at the lowest" +
          (hi > vals[0] + 1 ? ", " + money(hi) + " at the highest" : ""));
    }
    card = <>
      <div className="ddstrat-top"><span className="ddstrat-fam">{DD_FAMILY[S.family]}</span></div>
      <div className="ddstrat-blurb">{U.blurb}</div>
      {spark ? <>{spark}<div className="ddstrat-cap">{cap}</div></> : null}
    </>;
  }

  /* ---- the spending path ---- */
  const takesPath = !!S.path, kind = str("path"), stages = nb<PathStage>("pathStages");
  let pathNote = "";
  if (takesPath) {
    const m = P.path, last = m[m.length - 1];
    if (kind === "flat") pathNote = "Spending keeps its value, rising with inflation, as the strategy decides.";
    else if (kind === "ease")
      pathNote = "Real spending falls " + ddN(o.pathEase) + "% a year: by year " + o.years + ", " + pctStr(last, 0) +
        " of year one's" + (strat === "fixed" ? ", " + money(firstW * last) + " a year." : ".");
    else if (kind === "smile") {
      const age0 = o.retireAge != null ? o.retireAge : 65, at = (a: number) => { const i = Math.round(a - age0); return i >= 0 && i < m.length ? m[i] : null; };
      let lowI = 0;
      m.forEach((x, i) => { if (x < m[lowI]) lowI = i; });
      const a85 = at(85);
      pathNote = "David Blanchett's estimate of how retirees' real spending actually moves, for someone spending about " +
        money(firstW + P.G.income) + " a year: easing through the 70s" + (a85 != null ? ", about " + pctStr(1 - a85, 0) + " lower by 85" : "") +
        (lowI < m.length - 1 ? ", then rising again late in life" : "") + "." +
        (o.retireAge == null ? " It depends on age, so it takes retirement at 65 until you set your age above." : "");
    } else if (kind === "stages")
      pathNote = stages.length ? "Year one's level holds until the first stage below." : "Add a stage to change spending from a given " + (age != null ? "age." : "year.");
  }
  const setPath = (val: string) => setState((c) => {
    if (val !== "stages" || (c.pathStages as PathStage[]).length) return { ...c, path: val };
    const years = Math.min(60, Math.max(1, Math.round(parseNum(c.years as string))));
    const add: PathStage[] = [{ start: Math.min(years, 11), level: 90 }];
    if (years >= 21) add.push({ start: 21, level: 80 });
    return { ...c, path: val, pathStages: add };
  });
  const editList = <T,>(k: "pathStages" | "floorSteps" | "incomeItems" | "expenseItems", f: (list: T[]) => T[]) =>
    setState((c) => ({ ...c, [k]: f(c[k] as unknown as T[]) }) as DrawdownState);

  /* ---- guaranteed income ---- */
  const gOn = o.gShare > 0, G = P.G, tips = o.gType !== "annuity";
  const gNote = !gOn ? "" : money(o.initial * G.share) + " buys <b>" + money(G.income) + "</b> a year" +
    (tips ? " for " + o.years + " years, rising with inflation: a " + o.years + "-year TIPS ladder at " + pctStr((o.gYield || 0) / 100, 2) +
        " real pays " + pctStr(G.rate, 2) + " of its cost a year, then nothing."
      : " for life, " + (o.gInflate ? "rising with inflation." : "level in dollars, so inflation wears it down.")) +
    " The other " + money(o.initial - o.initial * G.share) + " stays invested and runs the strategy, and this income comes on top of what it spends.";

  /* ---- the minimum's changes ---- */
  const steps = nb<FloorStep>("floorSteps");
  const floorNote = steps.length && P.floor.some((x) => x > 0) ? "Minimum spending: " + lineWords(P.floor, age) + "." : "";

  /* ---- Monte Carlo ---- */
  const MH = ddMCHistory();

  const used = inputs === "simple" ? advInUse(d) : [];
  const clampFrom = () => setState(fromClamp);

  const startUnit = age != null;

  const items = (k: "incomeItems" | "expenseItems", elId: string) => {
    const list = nb<DdItem>(k);
    return (
      <div id={elId}>
        {list.map((it, i) => (
          <div key={i} className={it.on === false ? "itemrow off" : "itemrow"}>
            <input type="checkbox" data-itemtoggle={i} checked={it.on !== false}
              onChange={(e) => editList<DdItem>(k, (l) => l.map((x, j) => (j === i ? { ...x, on: e.target.checked } : x)))} />
            <span className="itemtxt" data-itemedit={i} onClick={() => open({ kind: "item", list: k, index: i })}>{it.name}<small>{describeItem(it, age)}</small></span>
            <button className="itemdel" type="button" data-itemdel={i} aria-label="Delete" onClick={() => {
              editList<DdItem>(k, (l) => l.filter((_, j) => j !== i));
              toast("Removed " + (it.name || "Item"));
            }}>&times;</button>
          </div>
        ))}
      </div>
    );
  };

  return (
    <aside id="asideDD" data-inputs={inputs}>
      <div className="panel inputs">
        <h2>Your plan<span className="h2ctrl">
          <span className="seg" id="segDDIn" aria-label="How many inputs">
            <button type="button" data-ddin="simple" className={inputs === "simple" ? "on" : undefined} onClick={() => setInputs("simple")}>Simple</button>
            <button type="button" data-ddin="adv" className={inputs === "adv" ? "on" : undefined} onClick={() => setInputs("adv")}>Advanced</button>
          </span>
        </span></h2>
        <div className="body">
          <div className="ddsec ddsec-first">Your portfolio at retirement</div>
          <Field id="ddInitial" label="Portfolio value">
            <Affixed prefix="$"><MoneyInput id="ddInitial" nonNeg value={str("initial")} onValueChange={set("initial")} /></Affixed>
            <button className="btn mini" type="button" id="ddCopy" style={{ marginTop: "6px" }} onClick={v.copyFromPlan}>Copy from your plan</button>
          </Field>
          <Field id="ddMixBtn" label={<Tipped text="Asset mix" k="ddstocks" />}>
            <button type="button" className="ddmixbtn" id="ddMixBtn" onClick={() => open({ kind: "mix" })}><span id="ddMixText">{mixText(o)}</span>
              <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M5 3.5l4.5 4.5L5 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
            <input type="hidden" id="ddStock" value={str("stock")} /><input type="hidden" id="ddSV" value={str("sv")} />
            <input type="hidden" id="ddCash" value={str("cash")} /><input type="hidden" id="ddStockEnd" value={str("stockEnd")} />
          </Field>
          <div className="ddadv">
            <SelectField id="ddRebal" label={<Tipped text="Rebalancing" k="ddrebal" />} value={str("rebal")} onChange={set("rebal")}>
              <option value="year">Every year</option>
              <option value="every">Every few years</option>
              <option value="band">When it drifts from the mix</option>
              <option value="never">Never</option>
            </SelectField>
            <NumberField id="ddRebalN" wrapId="ddRebalNWrap" hidden={o.rebal !== "every"} label="Rebalance every" unit="years" max={30} value={str("rebalN")} onValueChange={set("rebalN")} />
            <NumberField id="ddRebalBand" wrapId="ddRebalBandWrap" hidden={o.rebal !== "band"} label="When any holding is off by more than" unit="points" max={50} value={str("rebalBand")} onValueChange={set("rebalBand")} />
            <div className="hint" id="ddRebalNote" style={{ margin: "-6px 0 12px" }}>{rebalNote(o)}</div>
            <NumberField id="ddFee" label={<>Fees <span className="tipglue"><span className="opt">optional</span><TipDot k="fees" /></span></>} unit="%/yr" step={0.1} value={str("fee")} onValueChange={set("fee")} />
          </div>
          {/* Guaranteed income is set in the Asset mix pop-up; these hold it. */}
          <div id="ddGuarStore" hidden>
            <div className="ddgk-h ddsub">Guaranteed income <span className="opt">optional</span></div>
            <div className="two">
              <NumberField id="ddGShare" label="Share of the portfolio" unit="%" step={5} max={100} placeholder="0" value={str("gShare")} onValueChange={set("gShare")} />
              <SelectField id="ddGType" label="To buy" value={str("gType")} onChange={set("gType")}>
                <option value="tips">A TIPS ladder</option>
                <option value="annuity">An annuity</option>
              </SelectField>
            </div>
            <div id="ddGDetail" hidden={!gOn}>
              <NumberField id="ddGYield" wrapId="ddGYieldWrap" hidden={!tips} label="Real yield" unit="% after inflation" step={0.1} negative value={str("gYield")} onValueChange={set("gYield")} />
              <NumberField id="ddGPayout" wrapId="ddGPayoutWrap" hidden={tips} label="Payout rate" unit="% a year" step={0.25} value={str("gPayout")} onValueChange={set("gPayout")} />
              <div className="ddgk-final" id="ddGInflateWrap" hidden={tips}>
                <label className="ddgk-check"><input type="checkbox" id="ddGInflate" checked={!!s.gInflate} onChange={(e) => set("gInflate")(e.target.checked)} /><span>Payments rise with inflation</span></label>
              </div>
              <Html className="hint" id="ddGNote" style={{ marginTop: "-6px", marginBottom: "12px" }} html={gNote} />
            </div>
          </div>
          <div className="ddsec">Your retirement</div>
          <div className="two">
            <NumberField id="ddRetireAge" className="ddadv" label={<>Age at retirement <span className="tipglue"><span className="opt">optional</span><TipDot k="retireage" /></span></>} unit="age" max={120}
              value={str("retireAge")} onValueChange={(val) => setState((c) => {
                const next: DrawdownState = { ...c, retireAge: val };
                const a = parseNum(val);
                // "Starts after 0 years" carries over as "starts at this age"
                if (val.trim() !== "" && a > 0 && parseNum(c.ssDelay as string) === 0) next.ssDelay = String(Math.round(a));
                return next;
              })} />
            <NumberField id="ddYears" label="Years in retirement" unit="yrs" max={60} value={str("years")} onValueChange={set("years")} onBlur={clampFrom} />
          </div>
          <Html className="hint" id="ddFromNote" style={{ margin: "-6px 0 12px" }} html={fromNote} />

          <Field id="ddStrategy" label={<Tipped text="Withdrawal strategy" k="strategy" />}>
            <select id="ddStrategy" value={str("strategy")} onChange={(e) => set("strategy")(e.target.value)}>
              <optgroup label="Steady income">
                <option value="fixed">Fixed amount, rising with inflation</option>
                <option value="kitces">Kitces ratchet</option>
              </optgroup>
              <optgroup label="Share of the portfolio">
                <option value="pct">Fixed % of portfolio each year</option>
                <option value="clyatt">95% rule</option>
                <option value="oneovern">1/N: the balance over the years left</option>
                <option value="rmd">RMD method</option>
                <option value="vpw">Variable percentage withdrawal (VPW)</option>
              </optgroup>
              <optgroup label="Guardrails">
                <option value="guardrails">Guyton-Klinger Guardrails</option>
                <option value="riskgr">Risk-based guardrails</option>
              </optgroup>
              <optgroup label="Smoothed">
                <option value="floorceil">Floor &amp; ceiling</option>
                <option value="vanguard">Vanguard dynamic spending</option>
                <option value="yale">Yale Endowment</option>
                <option value="hebeler">Hebeler Autopilot II</option>
                <option value="sensible">Sensible withdrawals</option>
              </optgroup>
              <optgroup label="Valuation">
                <option value="cape">CAPE-based</option>
              </optgroup>
            </select>
            <div className="ddstrat" id="ddStratCard">{card}</div>
            <button type="button" className="linkbtn" id="ddStratGuide" onClick={() => open({ kind: "guide" })}>
              <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="6.3" stroke="currentColor" strokeWidth="1.4" /><path d="M8 7.2v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><circle cx="8" cy="4.9" r=".9" fill="currentColor" /></svg>
              How the strategies compare
            </button>
            <button type="button" className="linkbtn" id="ddStudyBtn" onClick={() => open({ kind: "study" })}>
              <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 2.8h7.5L13 5.3v7.9H3z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /><path d="M5.5 7.2h5M5.5 9.8h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
              Reproduce a classic study
            </button>
          </Field>
          <Field id="ddRate" wrapId="ddRateWrap" hidden={!U.rate} label={<span className="tipglue"><span id="ddRateLabel">{U.rate || "Withdrawal rate"}</span><TipDot k="ddrate" /></span>}>
            <Affixed suffix="%"><NumberInput id="ddRate" nonNeg step={0.25} value={str("rate")} onValueChange={set("rate")} /></Affixed>
            <div className="hint" id="ddRateNote">{o.initial > 0 ? money(firstW) + " per year (" + money(firstW / 12) + " per month)" : "Enter your portfolio value above to see this in dollars."}</div>
          </Field>
          <div className="ddgk-final ddskip ddadv" id="ddSkipWrap" hidden={!shown("ddSkipWrap")}>
            <label className="ddgk-check"><input type="checkbox" id="ddSkipRaise" checked={!!s.skipRaise} onChange={(e) => set("skipRaise")(e.target.checked)} /><span>Skip the inflation raise after a losing year</span></label>
            <TipDot k="skipraise" />
          </div>
          <div className="ddadv" id="ddGuardWrap" hidden={!shown("ddGuardWrap")}>
            <div className="ddgk-h">Upper guardrail: cut spending<TipDot k="guardrails" /></div>
            <div className="two">
              <NumberField id="ddGuardBand" label="Rate above target" unit="%" step={5} value={str("guardBand")} onValueChange={set("guardBand")} />
              <NumberField id="ddAdjust" label="Cut spending by" unit="%" max={100} value={str("adjust")} onValueChange={set("adjust")} />
            </div>
            <div className="ddgk-final">
              <label className="ddgk-check"><input type="checkbox" id="ddGkFinal" checked={!!s.gkFinal} onChange={(e) => set("gkFinal")(e.target.checked)} /><span>No cuts in the final</span></label>
              <Affixed suffix="yrs"><NumberInput id="ddGkFinalYrs" nonNeg max={60} disabled={!s.gkFinal} aria-label="Final years without cuts" value={str("gkFinalYrs")} onValueChange={set("gkFinalYrs")} /></Affixed>
              <TipDot k="gkfinal" />
            </div>
            <div className="ddgk-h">Lower guardrail: raise spending</div>
            <div className="two">
              <NumberField id="ddGuardBandLo" label="Rate below target" unit="%" step={5} max={100} value={str("guardBandLo")} onValueChange={set("guardBandLo")} />
              <NumberField id="ddAdjustLo" label="Raise spending by" unit="%" value={str("adjustLo")} onValueChange={set("adjustLo")} />
            </div>
          </div>
          <Html className="hint ddadv" id="ddGuardExample" hidden={!shown("ddGuardExample")} style={{ marginTop: "-6px", marginBottom: "12px" }} html={guardExample} />
          <div className="two ddadv" id="ddFloorWrap" hidden={!shown("ddFloorWrap")}>
            <NumberField id="ddFloor" label={<Tipped text="Max cut" k="maxcut" />} unit="%" value={str("floor")} onValueChange={set("floor")} />
            <NumberField id="ddCeil" label={<Tipped text="Max raise" k="maxraise" />} unit="%" value={str("ceil")} onValueChange={set("ceil")} />
          </div>
          <div className="two ddadv" id="ddVgWrap" hidden={!shown("ddVgWrap")}>
            <NumberField id="ddVgFloor" label={<Tipped text="Max cut" k="maxcut" />} unit="%" step={0.5} value={str("vgFloor")} onValueChange={set("vgFloor")} />
            <NumberField id="ddVgCeil" label={<Tipped text="Max raise" k="maxraise" />} unit="%" step={0.5} value={str("vgCeil")} onValueChange={set("vgCeil")} />
          </div>
          <div className="ddadv" id="ddKitWrap" hidden={!shown("ddKitWrap")}>
            <div className="two">
              <NumberField id="ddKitThresh" label={<Tipped text="Raise when the portfolio is" k="kitces" />} unit="% up" step={5} value={str("kitThresh")} onValueChange={set("kitThresh")} />
              <NumberField id="ddKitRaise" label="Raise spending by" unit="%" value={str("kitRaise")} onValueChange={set("kitRaise")} />
            </div>
            <NumberField id="ddKitGap" label="At most once every" unit="years" max={30} value={str("kitGap")} onValueChange={set("kitGap")} />
          </div>
          <NumberField id="ddClyFloor" wrapId="ddClyWrap" className="ddadv" hidden={!shown("ddClyWrap")} label={<Tipped text="Never less than" k="clyatt" />} unit="% of last year's" max={100} value={str("clyFloor")} onValueChange={set("clyFloor")} />
          <div className="two" id="ddHebWrap" hidden={!shown("ddHebWrap")}>
            <NumberField id="ddHebWeight" label={<Tipped text="Weight on last year" k="hebeler" />} unit="%" step={5} max={100} value={str("hebWeight")} onValueChange={set("hebWeight")} />
            <NumberField id="ddHebRate" label={<Tipped text="Expected return" k="vpwrate" />} unit="% real" step={0.25} negative value={str("hebRate")} onValueChange={set("hebRate")} />
          </div>
          <NumberField id="ddSensExtra" wrapId="ddSensWrap" className="ddadv" hidden={!shown("ddSensWrap")} label={<Tipped text="Plus, of last year's real gains" k="sensible" />} unit="%" step={5} max={100} value={str("sensExtra")} onValueChange={set("sensExtra")} />
          <div id="ddRgWrap" hidden={!shown("ddRgWrap")}>
            <NumberField id="ddRgTarget" label={<Tipped text="Target chance of lasting" k="riskgr" />} unit="%" max={99.9} value={str("rgTarget")} onValueChange={set("rgTarget")} />
            <div className="two">
              <NumberField id="ddRgLo" label="Cut when it falls below" unit="%" step={5} max={100} value={str("rgLo")} onValueChange={set("rgLo")} />
              <NumberField id="ddRgHi" label="Raise when it's above" unit="%" max={100} value={str("rgHi")} onValueChange={set("rgHi")} />
            </div>
          </div>
          <div className="two" id="ddCapeWrap" hidden={!shown("ddCapeWrap")}>
            <NumberField id="ddCapeA" label={<Tipped text="Base rate" k="capebased" />} unit="%" step={0.25} negative value={str("capeA")} onValueChange={set("capeA")} />
            <NumberField id="ddCapeB" label="Plus 1/CAPE times" unit="×" step={0.05} value={str("capeB")} onValueChange={set("capeB")} />
          </div>
          <div className="two" id="ddYaleWrap" hidden={!shown("ddYaleWrap")}>
            <NumberField id="ddYaleWeight" label={<Tipped text="Weight on last year" k="yale" />} unit="%" step={5} max={100} value={str("yaleWeight")} onValueChange={set("yaleWeight")} />
            <NumberField id="ddYaleRate" label="Target spending rate" unit="%" step={0.25} value={str("yaleRate")} onValueChange={set("yaleRate")} />
          </div>
          <Html className="hint" id="ddYaleNote" hidden={!shown("ddYaleNote")} style={{ marginTop: "-6px", marginBottom: "12px" }} html={yaleNote} />
          <div id="ddVpwWrap" hidden={!shown("ddVpwWrap")}>
            <NumberField id="ddVpwRate" label={<Tipped text="Expected rate of return" k="vpwrate" />} unit="% after inflation" step={0.25} negative value={str("vpwRate")} onValueChange={set("vpwRate")} />
            <MoneyField id="ddVpwFV" label={<Tipped text="PMT future value" k="vpwfv" />} value={str("vpwFV")} onValueChange={set("vpwFV")} />
          </div>
          <Html className="hint" id="ddVpwNote" hidden={!shown("ddVpwNote")} style={{ marginTop: "-6px", marginBottom: "12px" }} html={vpwNote} />
          <Html className="hint" id="ddStratNote" hidden={!note} style={{ marginTop: "-6px", marginBottom: "12px" }} html={note} />
          <div className="ddadv">
            <div className="two" id="ddSpendFloorWrap" hidden={S.limits === false}>
              <MoneyField id="ddSpendFloor" label={<Tipped text="Minimum spending" k="spendfloor" />} value={str("spendFloor")} onValueChange={set("spendFloor")} />
              <MoneyField id="ddSpendCeil" label={<Tipped text="Maximum spending" k="spendceil" />} value={str("spendCeil")} onValueChange={set("spendCeil")} />
            </div>
            <div className="hint acwarn" id="ddSpendNote2" hidden={!clash} style={{ marginTop: "-6px", marginBottom: "12px" }}>{clash ? "Your minimum is above your maximum, so the maximum wins." : ""}</div>
            <div id="ddFloorStepsWrap" hidden={S.limits === false}>
              <div id="ddFloorStepList">
                {steps.map((st, i) => {
                  const s0 = Math.max(2, Math.round(st.start || 0));
                  return (
                    <div className="stagecard ddfloorcard" key={i}>
                      <div className="stagehead"><span className="stagenum">Change {i + 1}</span>
                        <span className="stagespan" data-fsspan={i}>{s0 > P.floor.length ? "after the plan ends" : age != null ? "Age " + ddN(ageVal(age, s0)) + " on" : "Year " + s0 + " on"}</span>
                        <button className="btn mini" type="button" data-fsdel={i} onClick={() => editList<FloorStep>("floorSteps", (l) => l.filter((_, j) => j !== i))}>Remove</button></div>
                      <div className="two">
                        <div className="field" style={{ marginBottom: 0 }}><label>{startUnit ? "From age" : "From year"}</label><div className="inputwrap">
                          <DraftInput nonNeg data-ff="start" data-fi={i} aria-label={"Change " + (i + 1) + " starts"} value={st.start}
                            format={(x) => ddN(age != null ? ageVal(age, x) : x)}
                            onType={(t) => editList<FloorStep>("floorSteps", (l) => l.map((x, j) => (j === i ? { ...x, start: Math.max(2, Math.round(age != null ? parseNum(t) - age + 1 : parseNum(t))) } : x)))} />
                          <span className="affix">{startUnit ? "age" : "yr"}</span></div></div>
                        <div className="field" style={{ marginBottom: 0 }}><label>Minimum</label><div className="inputwrap"><span className="affix">$</span>
                          <DraftInput money nonNeg data-ff="amount" data-fi={i} aria-label={"Change " + (i + 1) + " minimum"} value={st.amount}
                            format={(x) => groupDigits(Math.round(x || 0), true)}
                            onType={(t) => editList<FloorStep>("floorSteps", (l) => l.map((x, j) => (j === i ? { ...x, amount: Math.max(0, parseNum(t)) } : x)))} /></div></div>
                      </div>
                      <div className="field" style={{ margin: "10px 0 0" }}><label>Ease in over</label><div className="inputwrap">
                        <DraftInput nonNeg max={30} data-ff="glide" data-fi={i} aria-label={"Change " + (i + 1) + " eases in over"} value={st.glide || 0}
                          format={ddN}
                          onType={(t) => editList<FloorStep>("floorSteps", (l) => l.map((x, j) => (j === i ? { ...x, glide: Math.max(0, Math.min(30, Math.round(parseNum(t)))) } : x)))} />
                        <span className="affix">years (0 = all at once)</span></div></div>
                    </div>
                  );
                })}
              </div>
              <button className="btn mini" type="button" id="ddAddFloorStep" onClick={() => editList<FloorStep>("floorSteps", (l) => {
                const years = Math.min(60, Math.max(1, Math.round(num("years")))), base = num("spendFloor"), last = l[l.length - 1];
                return [...l, { start: Math.min(years, last ? last.start + 10 : Math.max(2, Math.round(years / 2))), amount: Math.round((last ? last.amount : base) * 0.875 / 1000) * 1000, glide: 0 }];
              })}>+ Change the minimum later</button>
              <div className="hint" id="ddFloorNote">{floorNote}</div>
            </div>
            <Field id="ddPath" wrapId="ddPathField" hidden={!takesPath} label={<Tipped text="Spending through retirement" k="ddpath" />}>
              <select id="ddPath" value={kind} onChange={(e) => setPath(e.target.value)}>
                <option value="flat">Steady, rising with inflation</option>
                <option value="ease">Easing a little each year</option>
                <option value="smile">The retirement spending smile</option>
                <option value="stages">In stages</option>
              </select>
              <div className="hint" id="ddPathNote">{pathNote}</div>
            </Field>
            <NumberField id="ddPathEase" wrapId="ddPathEaseWrap" hidden={!takesPath || kind !== "ease"} label="Real spending falls by" unit="% a year" step={0.25} negative value={str("pathEase")} onValueChange={set("pathEase")} />
            <div id="ddWdStagesWrap" hidden={!takesPath || kind !== "stages"}>
              <div id="ddWdStageList">
                <WdStages stages={stages} v={v} edit={(f) => editList<PathStage>("pathStages", f)} toast={toast} />
              </div>
              <button className="btn mini" type="button" id="ddAddWdStage" onClick={() => editList<PathStage>("pathStages", (l) => {
                const years = Math.min(60, Math.max(1, Math.round(num("years"))));
                const order = wdOrder(l), last = order[order.length - 1];
                const start = Math.min(years, (last ? last.start : 1) + 10);
                return [...l, { start: Math.max(2, start), level: last ? Math.max(0, (last.st.level ?? 100) - 10) : 90 }];
              })}>+ Add spending stage</button>
            </div>
            <SelectField id="ddSSMode" label="Social Security" value={ssMode} onChange={set("ssMode")} wrapStyle={{ marginTop: "14px" }}>
              <option value="none">Not included</option>
              <option value="est">Estimate it for me</option>
              <option value="manual">I know my benefit</option>
            </SelectField>
            <SelectField id="ddSSWho" wrapId="ddSSWhoWrap" hidden={ssMode === "none"} label={<Tipped text="Whose benefit" k="sswho" />} value={str("ssWho")} onChange={set("ssWho")}>
              <option value="single">Just me</option>
              <option value="couple">Me and a spouse</option>
            </SelectField>
            <div id="ddSSEst" hidden={ssMode !== "est"}>
              <div className="two">
                <MoneyField id="ddSSIncome" labelId="ddSSIncomeLabel" label={ssCouple ? "Your income" : "Current income"} value={str("ssIncome")} onValueChange={set("ssIncome")} />
                <ClaimAge id="ddSSClaim" value={str("ssClaim")} onChange={set("ssClaim")} />
              </div>
              <div className="two" id="ddSSEst2Wrap" hidden={!(ssMode === "est" && ssCouple)}>
                <MoneyField id="ddSSIncome2" label="Spouse's income" value={str("ssIncome2")} onValueChange={set("ssIncome2")} />
                <ClaimAge id="ddSSClaim2" value={str("ssClaim2")} onChange={set("ssClaim2")} />
              </div>
              <div className="hint" id="ddSSEstNote">{ssEstNote}</div>
            </div>
            <div id="ddSSManual" hidden={ssMode !== "manual"}>
              <MoneyField id="ddSSAmount" label={<span className="tipglue"><span id="ddSSAmountLabel">{ssCouple ? "Your annual benefit, today's dollars" : "Annual benefit, today's dollars"}</span><TipDot k="ssbenefit" /></span>} value={str("ssAmount")} onValueChange={set("ssAmount")} />
              <MoneyField id="ddSSAmount2" wrapId="ddSSAmount2Wrap" hidden={!(ssMode === "manual" && ssCouple)} label={<Tipped text="Spouse's annual benefit, today's dollars" k="ssbenefit" />} value={str("ssAmount2")} onValueChange={set("ssAmount2")} />
            </div>
            <Field id="ddSSDelay" wrapId="ddSSDelayWrap" hidden={ssMode === "none" || (ssMode === "est" && age != null)}
              label={<span className="tipglue"><span id="ddSSDelayLabel">{ssAgeMode ? "Starts at age" : "Starts after"}</span><TipDot k={ssAgeMode ? "ssdelayage" : "ssdelay"} /></span>}>
              <div className="inputwrap"><NumberInput id="ddSSDelay" nonNeg max={ssAgeMode ? 120 : 30} value={str("ssDelay")} onValueChange={set("ssDelay")} /><span className="affix" id="ddSSDelayAffix">yrs</span></div>
            </Field>
            <div className="field" style={{ marginTop: "14px" }}>
              <label><Tipped text="Other income" k="customincome" /></label>
              {items("incomeItems", "ddIncomeList")}
              <button className="btn mini" type="button" id="ddAddIncome" onClick={() => open({ kind: "item", list: "incomeItems", index: null })}>+ Add income source</button>
            </div>
            <div className="field">
              <label><Tipped text="Future expenses" k="customexpense" /></label>
              {items("expenseItems", "ddExpenseList")}
              <button className="btn mini" type="button" id="ddAddExpense" onClick={() => open({ kind: "item", list: "expenseItems", index: null })}>+ Add future expense</button>
            </div>
            <div className="ddsec">Goals</div>
            <MoneyField id="ddLegacyGoal" label={<>Legacy goal <span className="tipglue"><span className="opt">optional</span><TipDot k="legacy" /></span></>} value={str("legacyGoal")} onValueChange={set("legacyGoal")} />
            <Field id="ddComfort" label={<>Comfort line <span className="tipglue"><span className="opt">optional</span><TipDot k="ddcomfort" /></span></>}>
              <Affixed prefix="$" suffix="/yr"><MoneyInput id="ddComfort" nonNeg value={str("comfort")} onValueChange={set("comfort")} /></Affixed>
              <div className="hint" id="ddComfortNote">{v.comfortNote}</div>
            </Field>
            <div className="ddsec">Market history</div>
            <div className="two">
              <SelectField id="ddStarts" label={<Tipped text="Test a retirement" k="ddstarts" />} value={str("starts")} onChange={set("starts")}>
                <option value="year">Each January</option>
                <option value="month">Every month</option>
              </SelectField>
              <NumberField id="ddFromYear" label={<Tipped text="Starting from" k="ddfrom" />} unit={undefined} max={2025} value={str("fromYear")} onValueChange={set("fromYear")} onBlur={clampFrom} />
            </div>
            <div id="ddMCWrap" hidden={mode !== "mc"}>
              <div className="ddgk-h ddsub">Monte Carlo</div>
              <div className="two">
                <NumberField id="ddMcBlock" label={<Tipped text="Years drawn together" k="ddmcblock" />} unit="yrs" max={30} value={str("mcBlock")} onValueChange={set("mcBlock")} />
                <SelectField id="ddMcRet" label={<Tipped text="Returns" k="ddmcret" />} value={str("mcRet")} onChange={set("mcRet")}>
                  <option value="hist">History&apos;s</option>
                  <option value="own">Your own</option>
                </SelectField>
              </div>
              <div id="ddMcOwnWrap" hidden={!o.mcOwn}>
                <div className="two">
                  <NumberField id="ddMcStock" label="US stocks" unit="%/yr" step={0.5} negative value={str("mcStock")} onValueChange={set("mcStock")} />
                  <NumberField id="ddMcSV" wrapId="ddMcSVWrap" hidden={!(o.svPct > 0)} label="Small value" unit="%/yr" step={0.5} negative value={str("mcSV")} onValueChange={set("mcSV")} />
                  <NumberField id="ddMcBond" label="Bonds" unit="%/yr" step={0.5} negative value={str("mcBond")} onValueChange={set("mcBond")} />
                  <NumberField id="ddMcCash" wrapId="ddMcCashWrap" hidden={!(o.cashPct > 0)} label="Cash" unit="%/yr" step={0.5} negative value={str("mcCash")} onValueChange={set("mcCash")} />
                  <NumberField id="ddMcInfl" label="Inflation" unit="%/yr" step={0.5} negative value={str("mcInfl")} onValueChange={set("mcInfl")} />
                </div>
                <button className="btn mini" type="button" id="ddMcReset" onClick={() => setState((c) => ({
                  ...c, mcStock: MH.stock.toFixed(1), mcSV: MH.sv.toFixed(1), mcBond: MH.bond.toFixed(1), mcCash: MH.cash.toFixed(1), mcInfl: MH.infl.toFixed(1),
                }))}>Reset to history&apos;s</button>
              </div>
              <div className="hint" id="ddMcNote">{o.mcOwn ? "Long-run returns, compounded, before inflation. History's since 1927: US stocks " + MH.stock.toFixed(1) +
                "%, small value " + MH.sv.toFixed(1) + "%, bonds " + MH.bond.toFixed(1) + "%, cash " + MH.cash.toFixed(1) + "%, inflation " + MH.infl.toFixed(1) + "%." : ""}</div>
            </div>
          </div>
          <div className="hint ddsimple" id="ddSimpleNote">
            {inputs !== "simple" ? null : used.length
              ? <><b>Also in use:</b> {used.join(", ")}. <button type="button" className="linkbtn" data-ddadv onClick={() => setInputs("adv")}>Show them</button></>
              : <>Simple shows the essentials. <button type="button" className="linkbtn" data-ddadv onClick={() => setInputs("adv")}>Advanced</button> adds rebalancing, fees, Social Security, other income, spending limits, goals and how history is tested.</>}
          </div>
          <div className="derived">
            <div><span>Social Security</span><span className="num" id="ddSSShow">{o.ssAnnualTotal > 0 ? money(o.ssAnnualTotal) + "/yr" : "Not included"}</span></div>
            <div><span>First-year withdrawal, before tax</span><span className="num" id="ddFirstW">{money(firstW)}</span></div>
            <div><span>Per month</span><span className="num" id="ddFirstMo">{money(firstW / 12)}</span></div>
            <div><span>Periods tested</span><span className="num" id="ddPeriods">{periods}</span></div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function ClaimAge({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="field">
      <label htmlFor={id}><Tipped text="Claim at age" k="ssclaim" /></label>
      <div className="inputwrap"><select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {[62, 63, 64, 65, 66, 67, 68, 69, 70].map((a) => <option key={a} value={a}>{a}</option>)}
      </select><span className="affix">yrs</span></div>
    </div>
  );
}

/** A custom income or expense in a line. */
export function describeItem(it: DdItem, age: number | null): string {
  const when = it.startYear === 1 ? "starting immediately" : age != null ? "starting at age " + ageVal(age, it.startYear) : "starting year " + it.startYear;
  const dur = it.duration.type === "once" ? "one time" : it.duration.type === "years" ? "for " + it.duration.years + " years" : "rest of retirement";
  return money(it.annual) + "/yr, " + when + ", " + dur + " · " + (it.inflate ? "inflation-adjusted" : "fixed amount");
}

/* The spending stages: each from the year (or age) it starts, at its share
   of year one's spending. */
function WdStages({ stages, v, edit, toast }: { stages: PathStage[]; v: DDView; edit: (f: (l: PathStage[]) => PathStage[]) => void; toast: (m: string) => void }) {
  const { o, firstW, age } = v;
  const order = wdOrder(stages);
  const info = new Map<number, { span: string; note: string; warn: boolean }>();
  order.forEach((x, k) => {
    const next = order[k + 1], to = Math.min(o.years, next ? next.start - 1 : o.years);
    const live = x.start <= o.years && to >= x.start, lv = (x.st.level ?? 100) / 100;
    info.set(x.i, {
      span: !live ? "" : (age != null ? "Age " : "Year ") + fmtNum(age != null ? ageVal(age, x.start) : x.start) + " – " + fmtNum(age != null ? ageVal(age, to) : to),
      warn: !live,
      note: x.start > o.years ? "This starts after the " + fmtNum(o.years) + " years of retirement above, so it has no effect."
        : !live ? "Another stage starts the same year and takes its place."
          : o.strategy === "fixed" && firstW > 0 ? "That's " + money(firstW * lv) + " a year (" + money(firstW * lv / 12) + "/mo) in today's dollars."
            : fmtNum(lv * 100) + "% of what the strategy would pay that year.",
    });
  });
  return (
    <>
      {stages.map((st, i) => {
        const inf = info.get(i)!;
        return (
          <div className="stagecard" key={i}>
            <StageHead name={st.name} fallback={"Stage " + (i + 2)} aria={"Stage " + (i + 2)} span={inf.span}
              attrs={{ name: { "data-wdname": i }, span: { "data-wdspan": i }, del: { "data-wddel": i } }}
              rename={(name) => edit((l) => l.map((x, j) => {
                if (j !== i) return x;
                const { name: _old, ...rest } = x;
                return name ? { ...rest, name } : rest;
              }))}
              remove={() => {
                edit((l) => l.filter((_, j) => j !== i));
                toast("Removed " + (st.name || "Stage " + (i + 2)));
              }} />
            <div className="two">
              <div className="field" style={{ marginBottom: 0 }}><label data-wdstartlbl={i}>{age != null ? "Starts at age" : "Starts in year"}</label><div className="inputwrap">
                <DraftInput nonNeg data-wf="start" data-wi={i} aria-label={"Stage " + (i + 2) + " start"} value={st.start}
                  format={(x) => fmtNum(age != null ? ageVal(age, x) : x)}
                  onType={(t) => {
                    const n = parseNum(t);
                    if (!isFinite(n)) return;
                    edit((l) => l.map((x, j) => (j === i ? { ...x, start: Math.max(1, Math.round(age != null ? n - age + 1 : n)) } : x)));
                  }} />
                <span className="affix">{age != null ? "age" : "yr"}</span></div></div>
              <div className="field" style={{ marginBottom: 0 }}><label>Spending, of year one&apos;s</label><div className="inputwrap">
                <DraftInput nonNeg step={5} data-wf="level" data-wi={i} aria-label={"Stage " + (i + 2) + " spending, as a share of year one"} value={st.level ?? 100}
                  format={ddN} onType={(t) => edit((l) => l.map((x, j) => (j === i ? { ...x, level: Math.max(0, parseNum(t) || 0) } : x)))} />
                <span className="affix">%</span></div></div>
            </div>
            <div className={inf.warn ? "hint acwarn" : "hint"} data-wdnote={i}>{inf.note}</div>
          </div>
        );
      })}
    </>
  );
}
