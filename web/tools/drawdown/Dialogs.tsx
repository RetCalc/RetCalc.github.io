"use client";

/* The Drawdown Simulator's pop-ups: the asset mix (and guaranteed income),
   the strategy guide, the classic studies, and the form for an income source
   or future expense. From ddMixForm() in src/js/app/15c-drawdown-strategies.js,
   openStrategyGuide() and showItemForm() in 24-strategy-guide.js, and
   ddStudyForm() in 15e-drawdown-research.js. */

import { Fragment, useMemo, useState } from "react";
import { MON } from "@/components/charts/HistNotes";
import { MoneyInput, NumberInput } from "@/components/fields/NumberInput";
import { Modal, ModalTop } from "@/components/shell/Modal";
import { useToast } from "@/components/shell/Toast";
import { Html } from "@/components/common/Html";
import { DD_ORDER, DD_RESEARCH, DD_STRAT, ddGuaranteed } from "@/lib/engine/typed-drawdown";
import { groupDigits, money, parseNum } from "@/lib/format";
import type { DDView } from "./Drawdown";
import { DD_DEFAULTS, ddWrite, fromClamp, type DdItem } from "./fields";
import { DD_GUIDE } from "./guide";
import { Spark } from "./Spark";
import { DD_STUDY_UI } from "./studies";
import { MixRows, mixForm, mixOk } from "./MixRows";
import { DD_FAMILY, DD_STRAT_NAMES, ageVal, ddN, hardStart, mixParts, spendThrough } from "./text";
import { Button } from "@/components/ui/button";
import { Affixed } from "@/components/fields/Field";
import { InputGroupInput } from "@/components/ui/input-group";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/native-select";
import { Checkbox } from "@/components/ui/checkbox";

export type Dialog = { kind: "mix" | "guide" | "study" } | { kind: "item"; list: "incomeItems" | "expenseItems"; index: number | null };

export function DrawdownDialogs({ v, dialog, close }: { v: DDView; dialog: Dialog | null; close: () => void }) {
  if (!dialog) return null;
  if (dialog.kind === "mix") return <MixDialog v={v} close={close} />;
  if (dialog.kind === "guide") return <GuideDialog v={v} close={close} />;
  if (dialog.kind === "study") return <StudyDialog v={v} close={close} />;
  if (dialog.kind !== "item") return null;
  return <ItemDialog v={v} list={dialog.list} index={dialog.index} close={close} />;
}

/* ---- the asset mix: it won't save until it adds up to 100% ---- */
function MixDialog({ v, close }: { v: DDView; close: () => void }) {
  const { o } = v, m = mixParts(o);
  const [f, setF] = useState({
    ...mixForm(m),
    glide: o.stockPctEnd != null ? ddN(o.stockPctEnd) : "",
    g: o.gShare > 0 ? ddN(o.gShare) : "", gType: o.gType === "annuity" ? "annuity" : "tips",
    gYield: ddN(o.gYield), gPay: ddN(o.gPayout), gInfl: !!o.gInflate,
  });
  const up = (k: keyof typeof f) => (val: string | boolean) => setF((c) => ({ ...c, [k]: val }));
  const ok = mixOk(f);
  const g = Math.min(100, parseNum(f.g)), tips = f.gType !== "annuity";
  const G = ddGuaranteed({ ...o, gShare: g, gType: tips ? "tips" : "annuity", gYield: parseNum(f.gYield), gPayout: parseNum(f.gPay), gInflate: f.gInfl });
  const save = () => {
    if (!ok) return;
    v.setState((c) => ({
      ...c, stock: String(parseNum(f.stock)), sv: String(parseNum(f.sv)), cash: String(parseNum(f.cash)),
      stockEnd: f.glide.trim() === "" ? "" : String(Math.min(100, parseNum(f.glide))),
      gShare: g > 0 ? String(g) : "", gType: tips ? "tips" : "annuity", gYield: String(parseNum(f.gYield)), gPayout: String(parseNum(f.gPay)), gInflate: f.gInfl,
    }));
    close();
  };
  return (
    <Modal size="wide" onClose={close} focus="[data-mix]">
      <h3>Asset mix</h3>
      <div className="formhint" id="ddMixLead">{(g > 0 ? "How the " + money(o.initial * (1 - G.share)) + " that stays invested is split." : "How the portfolio is split at retirement.") +
        " Returns are each asset's actual history from July 1926."}</div>
      <MixRows f={f} up={up} totId="ddMixTot" />
      <div className="formfield"><Label className="mb-1.5"><span>Glide stocks to <Badge variant="outline" className="ml-1.25">optional</Badge></span></Label><Affixed suffix="% by the last year">
        <NumberInput nonNeg step={5} max={100} id="ddMixGlide" aria-label="Stocks at the end" value={f.glide} onValueChange={up("glide")} /></Affixed>
        <div className="formhint">Moves the stocks&apos; total in a straight line, small value keeping its share of the stocks. What leaves stocks goes to bonds and cash in the proportions you hold them (and what joins them comes from both the same way). Leave blank to hold the mix.</div></div>
      <div className="ddmixg"><h4>Set aside for guaranteed income <Badge variant="outline" className="ml-1.25">optional</Badge></h4>
        <div className="formhint">Part of the portfolio can buy income that doesn&apos;t depend on markets. It isn&apos;t invested or rebalanced: it&apos;s spent once, at retirement, and pays you every year. The mix above applies to the rest.</div>
        <div className="ddmixrow"><div><b>Share of the portfolio</b></div><Affixed suffix="%" className="w-27.5 flex-none"><NumberInput nonNeg step={5} max={100} id="ddMG" placeholder="0" aria-label="Share for guaranteed income" value={f.g} onValueChange={up("g")} /></Affixed></div>
        <div id="ddMGMore" hidden={!(g > 0)}>
          <div className="ddmixrow"><div><b>To buy</b></div><NativeSelect className="w-37.5 flex-none" id="ddMGType" aria-label="What it buys" value={f.gType} onChange={(e) => up("gType")(e.target.value)}><option value="tips">A TIPS ladder</option><option value="annuity">An annuity</option></NativeSelect></div>
          <div className="ddmixrow" id="ddMGYieldRow" hidden={!tips}><div><b>Real yield</b><small>What TIPS pay after inflation. Check today&apos;s.</small></div><Affixed suffix="%" className="w-27.5 flex-none"><NumberInput step={0.1} id="ddMGYield" aria-label="Real yield" value={f.gYield} onValueChange={up("gYield")} /></Affixed></div>
          <div className="ddmixrow" id="ddMGPayRow" hidden={tips}><div><b>Payout rate</b><small>From a quote: depends on age and rates.</small></div><Affixed suffix="%" className="w-27.5 flex-none"><NumberInput nonNeg step={0.25} id="ddMGPay" aria-label="Payout rate" value={f.gPay} onValueChange={up("gPay")} /></Affixed></div>
          <label className="ddgk-check my-2 mx-0" id="ddMGInflRow" hidden={tips}><Checkbox id="ddMGInfl" checked={f.gInfl} onCheckedChange={up("gInfl")} /><span>Payments rise with inflation</span></label>
          <div className="formhint" id="ddMGNote">{g > 0 ? money(o.initial * G.share) + " buys " + money(G.income) + " a year" +
            (tips ? " for " + o.years + " years, rising with inflation." : " for life" + (f.gInfl ? ", rising with inflation." : ", level in dollars.")) : ""}</div>
        </div>
      </div>
      <div className="formactions"><Button variant="outline" className="flex-1" data-mixcancel onClick={close}>Cancel</Button>
        <Button className="flex-1" data-mixok disabled={!ok} onClick={save}>Use this mix</Button></div>
    </Modal>
  );
}

/* ---- the strategy guide ---- */
interface GuideEntry { k: string; name: string; tag: string; how: string; pros: string[]; cons: string[]; fit: string }
const CMP_ROWS = [["Fixed amount", "Highest", "Yes", "Often a lot"], ["Kitces ratchet", "High, and only rises", "Yes", "Often a lot"],
  ["Fixed percentage", "Lowest", "No", "Often a lot"], ["95% rule", "Moderate", "Yes, in a long slump", "Moderate"],
  ["1/N", "Low", "Not before the horizon", "Nothing"], ["RMD method", "Low to moderate", "No", "Moderate"],
  ["VPW", "Low to moderate", "Not before the horizon", "About the future value"], ["Guardrails", "High, with occasional steps", "Rarely", "Moderate"],
  ["Risk-based guardrails", "High, with occasional resets", "Rarely", "Little, by design"], ["Floor and ceiling", "High", "Rarely", "Moderate"],
  ["Vanguard dynamic", "High", "Rarely", "Moderate"], ["Yale endowment", "High, slow to change", "Sometimes", "Moderate"],
  ["Autopilot II", "High, slow to change", "Rarely", "Little"], ["Sensible withdrawals", "Moderate", "Yes", "Often a lot"], ["CAPE-based", "Low to moderate", "No", "Moderate"]];

function GuideDialog({ v, close }: { v: DDView; close: () => void }) {
  const toast = useToast();
  const cur = v.s.strategy as string, o = v.o;
  // Each strategy's spending through one hard start, with the plan's other inputs.
  const w = useMemo(() => (o.initial > 0 ? hardStart(o) : null), [o]);
  const when = w ? (w.month !== 1 ? MON[w.month - 1] + " " : "") + w.year : "";
  const byKey = Object.fromEntries((DD_GUIDE as GuideEntry[]).map((g) => [g.k, g]));
  return (
    <Modal size="guide" onClose={close} focus="[data-modal-x]">
      <ModalTop title="How the withdrawal strategies compare" onClose={close} />
      <p className="sg-intro">Every strategy trades a steady income against protection from running out.
        Rules that never cut spending can run dry in a bad decade; rules that follow the market can&apos;t run out,
        but your income moves with it. The minimum and maximum spending limits work with every strategy except fixed amount,
        and the spending path and guaranteed income with all of them. To see them all at the same risk, open <b>Compare strategies</b> in the results.</p>
      <div className="sg-cmpwrap"><table className="sg-cmp"><thead><tr><th>Strategy</th><th>Income stability</th><th>Can run out</th><th>Left at the end</th></tr></thead>
        <tbody>{CMP_ROWS.map((r) => <tr key={r[0]}>{r.map((c, i) => <td key={i}>{c}</td>)}</tr>)}</tbody></table></div>
      {Object.keys(DD_FAMILY).map((fam) => {
        const items = DD_ORDER.filter((k) => DD_STRAT[k].family === fam && byKey[k]);
        if (!items.length) return null;
        return (
          <Fragment key={fam}>
            <h4 className="sg-fam">{DD_FAMILY[fam]}</h4>
            {items.map((k) => {
              const g = byKey[k];
              const vals = w ? spendThrough({ ...o, strategy: k }, w) : null;
              return (
                <section key={k} className={"sg-item" + (k === cur ? " sg-cur" : "")}>
                  <div className="sg-head"><h4>{g.name}</h4><span className="sg-tag">{g.tag}</span>
                    {k === cur ? <Badge variant="positive" className="ml-auto">Selected</Badge>
                      : <Button variant="outline" size="sm" className="ml-auto" data-usestrat={k} onClick={() => {
                        v.set("strategy")(k);
                        close();
                        toast("Using " + DD_STRAT_NAMES[k]);
                      }}>Use this strategy</Button>}</div>
                  {vals ? <div className="sg-spark"><Spark vals={vals} w={300} h={40} />
                    <span>Retiring in {when}, with your plan: {money(vals[0])} in year one, {money(Math.min(...vals))} at the lowest</span></div> : null}
                  <Html as="p" html={g.how} />
                  <div className="sg-pc"><div><div className="sg-lbl pos">Pros</div><Html as="ul" html={g.pros.map((t) => "<li>" + t + "</li>").join("")} /></div>
                    <div><div className="sg-lbl neg">Cons</div><Html as="ul" html={g.cons.map((t) => "<li>" + t + "</li>").join("")} /></div></div>
                  <p className="sg-fit"><b>A good fit if:</b> {g.fit}</p>
                </section>
              );
            })}
          </Fragment>
        );
      })}
      <p className="sg-foot">Test any of them against every retirement since 1926 with the simulator; the success rate
        and the income chart show the trade-off for your own numbers.</p>
      <div className="formactions"><Button variant="outline" className="flex-1" data-guideclose onClick={close}>Close</Button></div>
    </Modal>
  );
}

/* ---- the classic studies, reproduced ---- */
interface StudyUI { title: string; cite: string; setup: string; paper: string; sim: (f: Record<string, unknown>) => string; why: string }
function StudyDialog({ v, close }: { v: DDView; close: () => void }) {
  const toast = useToast();
  const found = useMemo(() => DD_RESEARCH.map((S) => ({ S, f: S.find() })), []);
  const load = (id: string) => {
    const S = DD_RESEARCH.find((x) => x.id === id)!, U = (DD_STUDY_UI as Record<string, StudyUI>)[id];
    const st: Record<string, unknown> = { ...DD_DEFAULTS, initial: v.o.initial > 0 ? parseNum(v.s.initial as string) : 1000000, ...S.setup,
      incomeItems: [], expenseItems: [], floorSteps: [], pathStages: [] };
    if (st.retireAge == null) st.retireAge = "";
    v.setState((c) => fromClamp(ddWrite(c, st)));
    toast("Loaded " + U.title.replace(/ \(.*\)$/, "") + "'s setup");
  };
  return (
    <Modal size="study" onClose={close} focus="[data-modal-x]">
      <ModalTop title="Classic studies, reproduced" onClose={close} />
      <div className="formhint">Each study set up as the paper did, run on this record: stocks, bonds and inflation since 1926. What the paper found, and what the simulator finds.</div>
      {found.map(({ S, f }) => {
        const U = (DD_STUDY_UI as Record<string, StudyUI>)[S.id];
        return (
          <div className="ddstudy" key={S.id}><h4>{U.title}</h4><Html className="ddstudy-cite" html={U.cite} />
            <div className="ddstudy-k">Setup</div><p>{U.setup}</p>
            <div className="ddstudy-k">The paper found</div><p>{U.paper}</p>
            <div className="ddstudy-k">The simulator finds</div><Html className="ddstudy-sim" html={U.sim(f)} />
            <p className="ddstudy-why">{U.why}</p>
            <Button variant="outline" size="sm" data-study={S.id} onClick={() => { close(); load(S.id); }}>Load this setup</Button></div>
        );
      })}
      <div className="formactions"><Button variant="outline" className="flex-1" data-studyclose onClick={close}>Close</Button></div>
    </Modal>
  );
}

/* ---- an income source or future expense ---- */
function ItemDialog({ v, list, index, close }: { v: DDView; list: "incomeItems" | "expenseItems"; index: number | null; close: () => void }) {
  const toast = useToast();
  const isIncome = list === "incomeItems", age = v.age, ageMode = age != null;
  const existing = index != null ? (v.s[list] as DdItem[])[index] : null;
  const [f, setF] = useState(() => {
    const dur = existing?.duration;
    return {
      name: existing?.name ?? "", amount: existing?.annual ? groupDigits(existing.annual, true) : "", inflate: existing ? existing.inflate !== false : true,
      start: String(ageMode ? ageVal(age, existing?.startYear || 1) : existing?.startYear || 1),
      dur: (dur?.type ?? "forever") as DdItem["duration"]["type"], years: String((dur && dur.type === "years" && dur.years) || 5),
    };
  });
  const up = (k: keyof typeof f) => (val: string | boolean) => setF((c) => ({ ...c, [k]: val }));
  const save = () => {
    const name = f.name.trim() || (isIncome ? "Income" : "Expense");
    const annual = parseNum(f.amount);
    if (!(annual > 0)) {
      toast("Enter an amount greater than zero");
      return;
    }
    const rawStart = Math.round(parseNum(f.start)) || (ageMode ? age : 1);
    const startYear = ageMode ? Math.max(1, rawStart - age + 1) : Math.max(1, rawStart);
    const years = Math.max(1, Math.round(parseNum(f.years)) || 1);
    const item: DdItem = { name, annual, inflate: f.inflate, startYear, on: existing ? existing.on : true,
      duration: f.dur === "years" ? { type: "years", years } : { type: f.dur } };
    close();
    v.setState((c) => {
      const l = (c[list] as DdItem[]).slice();
      if (index != null) l[index] = item;
      else l.push(item);
      return { ...c, [list]: l };
    });
    if (index == null) toast("Added " + item.name);
  };
  return (
    <Modal size="wide" onClose={close} focus="#itName">
      <h3>{(existing ? "Edit " : "Add ") + (isIncome ? "income source" : "future expense")}</h3>
      <div className="formhint">{isIncome ? "A pension, rental property, part-time work, an inheritance: anything that offsets what you'd otherwise withdraw."
        : "A car, a boat, long-term care costs: anything on top of your regular spending."}</div>
      <div className="formfield"><Label className="mb-1.5"><span>Name</span></Label>
        <Input id="itName" type="text" maxLength={40} placeholder={isIncome ? "e.g. Pension" : "e.g. New car"} value={f.name} onChange={(e) => up("name")(e.target.value)} /></div>
      <div className="formfield"><Label className="mb-1.5"><span>Annual amount, today&apos;s dollars</span></Label>
        <Affixed prefix="$"><MoneyInput id="itAmount" nonNeg value={f.amount} onValueChange={up("amount")} /></Affixed></div>
      <label className="formcheck"><Checkbox id="itInflate" checked={f.inflate} onCheckedChange={up("inflate")} /> Adjust for inflation over time</label>
      <div className="formtwo">
        <div className="formfield"><Label className="mb-1.5"><span>{ageMode ? "Starts at age" : "Starts in year"}</span></Label>
          <Affixed suffix={ageMode ? "yrs" : "of ret."}><InputGroupInput variant="numeric" id="itStartYear" type="text" inputMode="decimal" value={f.start} onChange={(e) => up("start")(e.target.value)} /></Affixed></div>
        <div className="formfield"><Label className="mb-1.5"><span>Lasts</span></Label>
          <NativeSelect id="itDuration" value={f.dur} onChange={(e) => up("dur")(e.target.value)}>
            <option value="once">One time only</option>
            <option value="years">A number of years</option>
            <option value="forever">Rest of retirement</option>
          </NativeSelect></div>
      </div>
      <div className="formfield" id="itYearsWrap" hidden={f.dur !== "years"}>
        <Label className="mb-1.5"><span>Number of years</span></Label>
        <Affixed suffix="yrs"><InputGroupInput variant="numeric" id="itYears" type="text" inputMode="decimal" value={f.years} onChange={(e) => up("years")(e.target.value)} /></Affixed></div>
      <div className="formactions">
        <Button variant="outline" className="flex-1" onClick={close}>Cancel</Button>
        <Button className="flex-1" id="itSave" onClick={save}>{existing ? "Save" : "Add"}</Button>
      </div>
    </Modal>
  );
}
