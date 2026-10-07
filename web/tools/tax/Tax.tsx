"use client";

/* Income Tax: 2026 federal, state and FICA tax on a salary, or, in
   retirement mode, on a year of withdrawals from each kind of account.
   Ported from src/js/app/11-income-tax.js and src/main/10-tax-inputs.html,
   18-income-tax.html. */

import { useRef, useState } from "react";
import { ShareBar } from "@/components/charts/Legend";
import { useHouseholdFill } from "@/components/household/HouseholdProvider";
import { Affixed, Field, MoneyField, NumberField, SelectField } from "@/components/fields/Field";
import { MoneyInput } from "@/components/fields/NumberInput";
import { Tipped, TipDot } from "@/components/shell/Tooltips";
import { useToolState } from "@/components/tools/ToolState";
import { Segmented } from "@/components/common/Readout";
import { HeroReading, PinnedReading } from "@/components/common/Reading";
import { CsvButton } from "@/components/common/CsvButton";
import { FED_STD, NIIT, bracketRoom } from "@/lib/engine/typed";
import { DASH, groupDigits, money, pctStr } from "@/lib/format";
import { STATE_OPTIONS } from "@/lib/states";
import { TAX_DEF, runTax, taxInput } from "./model";
import { LTCG_COLORS, stackChartSvg } from "./stackChart";
import { stateGaps, stateRuleRows } from "./stateRules";
import { useShareKit } from "@/components/shell/share";
import { taxShare } from "./share";
import { SERIES, baseColor, hatchClass, hatched, svgPaint } from "@/lib/hues";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { HatchDefs } from "@/components/charts/HatchDefs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDownIcon, CircleAlertIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const TAX_COLORS = { fed: SERIES.rose, state: SERIES.lavender, fica: SERIES.sky, net: SERIES.teal };
const BKT_COLORS: string[] = [SERIES.rose, SERIES.teal, SERIES.sky, SERIES.lavender, SERIES.gray, hatched(SERIES.gray)]; // trad, roth, brok, ss, pension, other

interface Part { v: number; c: string; label: string }
interface Bar { label: string; v: number; share: number; c: string }

/* One row of the tax breakdown table. */
const TxRow = ({ k, v, eff, c }: { k: string; v: number; eff: number; c: string }) => (
  <tr><td>{k}</td><td>{money(v)}</td><td>{pctStr(eff, 2)}</td><td><Key c={c} /> {pctStr(eff, 1)}</td></tr>
);

/* A table row's key: the source's swatch, hatched or plain. */
function Key({ c }: { c: string }) {
  return <i className={"tipsw bg-(--swatch)" + hatchClass(c)} style={{ "--swatch": baseColor(c) } as React.CSSProperties}></i>;
}

/* The donut: each slice dims the others on hover, and its label and amount
   take the center. The bars beside it do the same. */
function Donut({ parts, center, active }: { parts: Part[]; center: string; active: number | null }) {
  const R = 100, C = 110, sw = 30, circ = 2 * Math.PI * (R - sw / 2);
  const tot = parts.reduce((a, x) => a + x.v, 0) || 1;
  // Where each slice starts, as a share of the ring.
  const starts = parts.map((_, i) => parts.slice(0, i).reduce((a, x) => a + Math.max(0, x.v / tot), 0));
  const pt = active != null ? parts[active] : null;
  return (
    <>
      <defs><HatchDefs prefix="txh" colors={parts.map((p) => p.c)} /></defs>
      {parts.map((p, i) => {
        const frac = p.v / tot, off = starts[i];
        if (frac <= 0) return null;
        return (
          <circle key={i} cx={C} cy={C} r={R - sw / 2} fill="none" stroke={svgPaint(p.c, "txh")} strokeWidth={sw}
            strokeDasharray={(frac * circ).toFixed(2) + " " + circ.toFixed(2)} strokeDashoffset={(-off * circ).toFixed(2)}
            transform={`rotate(-90 ${C} ${C})`} data-idx={i}
            className={active == null || active === i ? "transition-opacity duration-150 cursor-pointer" : "transition-opacity duration-150 cursor-pointer opacity-18"} />
        );
      })}
      <text id="txPieLbl" x="110" y="104" textAnchor="middle" fontSize="13" fill="var(--dim)" className="font-sans pointer-events-none">{pt ? pt.label : "All taxes"}</text>
      <text id="txPieVal" x="110" y="128" textAnchor="middle" fontSize="22" fontWeight="600" fill="var(--text)" className="font-mono pointer-events-none">{pt ? money(pt.v) : center}</text>
    </>
  );
}

export function Tax() {
  const { state: s, set, setState } = useToolState(TAX_DEF);
  useShareKit(TAX_DEF.id, taxShare(s));
  const [active, setActive] = useState<number | null>(null);
  const deactivate = useRef<ReturnType<typeof setTimeout>>(undefined);
  const activate = (i: number) => {
    clearTimeout(deactivate.current);
    setActive(i);
  };
  const leave = () => {
    deactivate.current = setTimeout(() => setActive(null), 60);
  };
  const tableRef = useRef<HTMLTableElement>(null), bucketRef = useRef<HTMLTableElement>(null), bracketRef = useRef<HTMLTableElement>(null), rulesRef = useRef<HTMLTableElement>(null);

  // The household's filing status, state and incomes.
  useHouseholdFill("tax", (h) => setState((c) => ({
    ...c, status: h.status === "m" ? "m" : "s",
    gross2: groupDigits(h.status === "m" && h.income2 != null ? h.income2 : 0, true),
    ...(h.income != null ? { gross: groupDigits(h.income, true) } : {}),
    ...(h.state ? { state: h.state } : {}),
  })));

  const ret = s.mode === "retire";
  const joint = s.status === "m";
  const split = !ret && joint;
  const inp = taxInput(s);
  const R = runTax(inp);

  // ---- what each mode shows
  let head: { netLabel: string; netNote: string; monthNote: string; thirdLabel: string; thirdNote: string; net: string; month: string; third: string };
  let derived: { stdLabel: string; std: string; ssRow: string | null; marginal: string; roomLabel: string; room: string; zeroRoom: string | null };
  let bars: Bar[], parts: Part[], rows: React.ReactNode;

  const room = (taxable: number) => {
    const br = bracketRoom(taxable, inp.status);
    return { roomLabel: br ? "Room before " + pctStr(br.nextRate, 0) : "Room before next bracket", room: br ? money(br.room) : "Top bracket" };
  };
  const noRoom = { roomLabel: "Room before next bracket", room: DASH };
  const totals = (afterLabel: string, grossLabel: string) => (
    <>
      <tr className="font-semibold"><td>All taxes</td><td>{money(R.total)}</td><td>{pctStr(R.effTotal, 2)}</td><td></td></tr>
      <tr><td>{afterLabel}</td><td>{money(R.net)}</td><td>{pctStr(R.effNet, 2)}</td><td></td></tr>
      {R.pre > 0 ? <tr><td>Pre-tax deductions</td><td>{money(R.pre)}</td><td>{pctStr(R.gross ? R.pre / R.gross : 0, 2)}</td><td></td></tr> : null}
      <tr className="font-semibold border-t-2 border-t-line"><td>{grossLabel}</td><td>{money(R.gross)}</td><td>100.00%</td><td></td></tr>
    </>
  );
  const share = (v: number) => (R.gross ? v / R.gross : 0);
  const stateLabel = "State income tax" + (R.stateNone ? " (none)" : "");
  const stateRow = <TxRow k={"State income tax" + (R.stateName ? " · " + R.stateName : "")} v={R.state} eff={R.effState} c={TAX_COLORS.state} />;

  if (!ret) {
    // Net pay is gross minus taxes; take-home also takes out pre-tax savings,
    // money you keep but never see in the paycheck.
    const netPay = R.gross - R.total;
    const shown = s.view === "take" ? R.net : netPay;
    head = {
      netLabel: s.view === "take" ? "Take-home pay" : "Net pay",
      netNote: R.gross > 0
        ? s.view === "take" ? pctStr(R.gross ? R.net / R.gross : 0, 1) + " of gross, after pre-tax savings" : pctStr(R.gross ? netPay / R.gross : 0, 1) + " of gross, after taxes"
        : "Enter your income to begin",
      monthNote: s.view === "take" ? "In your paycheck, after pre-tax savings" : "After all taxes",
      thirdLabel: "Every two weeks", thirdNote: "26 paychecks a year",
      net: money(shown), month: money(shown / 12), third: money(shown / 26),
    };
    derived = {
      stdLabel: "Standard deduction", std: money((FED_STD as Record<string, number>)[inp.status]), ssRow: null,
      marginal: pctStr(R.marginal, 0), ...(R.gross > 0 ? room(R.fedTaxable) : noRoom), zeroRoom: null,
    };
    bars = [
      { label: "Take-home pay", v: R.net, share: R.effNet, c: TAX_COLORS.net },
      { label: "Federal income tax", v: R.federal, share: R.effFed, c: TAX_COLORS.fed },
      { label: stateLabel, v: R.state, share: R.effState, c: TAX_COLORS.state },
      { label: "FICA (Social Security + Medicare)", v: R.fica, share: R.effFica, c: TAX_COLORS.fica },
    ];
    if (R.pre > 0) bars.push({ label: "Pre-tax savings", v: R.pre, share: share(R.pre), c: hatched(SERIES.gray) });
    parts = [{ v: R.net, c: TAX_COLORS.net, label: "Take-home pay" }, { v: R.federal, c: TAX_COLORS.fed, label: "Federal tax" },
      { v: R.state, c: TAX_COLORS.state, label: "State tax" }, { v: R.fica, c: TAX_COLORS.fica, label: "FICA" }];
    if (R.pre > 0) parts.push({ v: R.pre, c: hatched(SERIES.gray), label: "Pre-tax savings" });
    // The Social Security wage cap applies per earner, so a joint return
    // shows a line for each rather than one shared cap.
    rows = (
      <>
        <TxRow k="Federal income tax" v={R.federal} eff={R.effFed} c={TAX_COLORS.fed} />
        {stateRow}
        {inp.status === "m" ? (
          <>
            <TxRow k="Your Social Security" v={R.ss1} eff={share(R.ss1)} c={TAX_COLORS.fica} />
            <TxRow k="Spouse's Social Security" v={R.ss2} eff={share(R.ss2)} c={TAX_COLORS.fica} />
          </>
        ) : <TxRow k="Social Security" v={R.ss} eff={share(R.ss)} c={TAX_COLORS.fica} />}
        <TxRow k={"Medicare" + (R.addl > 0 ? " (incl. surtax)" : "")} v={R.med + R.addl} eff={share(R.med + R.addl)} c={TAX_COLORS.fica} />
        {totals("Take-home pay", "Gross pay")}
      </>
    );
  } else {
    head = {
      netLabel: "Income after tax", netNote: R.gross > 0 ? pctStr(R.effNet, 1) + " of what you withdrew" : "Enter your withdrawals to begin",
      monthNote: "After all taxes", thirdLabel: "Effective tax rate", thirdNote: R.gross > 0 ? "Marginal on the next dollar: " + pctStr(R.marginal, 1) : "",
      net: money(R.net), month: money(R.net / 12), third: pctStr(R.effTotal, 2),
    };
    derived = {
      stdLabel: inp.dedType === "item" ? "Itemized deduction" : R.seniors > 0 ? "Standard deduction, incl. 65+" : "Standard deduction",
      std: money(R.fedDed),
      ssRow: R.ssGross > 0 ? money(R.taxableSS) + " (" + pctStr(R.taxableSS / R.ssGross, 0) + ")" : null,
      marginal: pctStr(R.marginal, 1),
      ...(R.gross > 0 ? room(R.ordTaxable) : noRoom),
      zeroRoom: R.gross > 0 ? (R.zeroRoom > 0 ? money(R.zeroRoom) : "None left") : null,
    };
    bars = [
      { label: "Income after tax", v: R.net, share: R.effNet, c: TAX_COLORS.net },
      { label: "Federal ordinary income tax", v: R.fedOrdinary, share: share(R.fedOrdinary), c: TAX_COLORS.fed },
      { label: "Federal long-term capital gain tax", v: R.ltcg, share: share(R.ltcg), c: LTCG_COLORS[1] },
    ];
    if (R.niit > 0) bars.push({ label: "Net investment income tax (3.8%)", v: R.niit, share: share(R.niit), c: SERIES.gray });
    bars.push({ label: stateLabel, v: R.state, share: R.effState, c: TAX_COLORS.state });
    if (R.pre > 0) bars.push({ label: "Pre-tax deductions", v: R.pre, share: share(R.pre), c: hatched(SERIES.gray) });
    parts = [{ v: R.net, c: TAX_COLORS.net, label: "Income after tax" }, { v: R.fedOrdinary, c: TAX_COLORS.fed, label: "Federal ordinary tax" },
      { v: R.ltcg, c: LTCG_COLORS[1], label: "Capital gain tax" }, { v: R.niit, c: SERIES.gray, label: "Net investment tax" },
      { v: R.state, c: TAX_COLORS.state, label: "State tax" }];
    if (R.pre > 0) parts.push({ v: R.pre, c: hatched(SERIES.gray), label: "Pre-tax deductions" });
    rows = (
      <>
        <TxRow k="Federal tax on ordinary income" v={R.fedOrdinary} eff={share(R.fedOrdinary)} c={TAX_COLORS.fed} />
        <TxRow k="Federal tax on long-term gains" v={R.ltcg} eff={share(R.ltcg)} c={LTCG_COLORS[1]} />
        {R.niit > 0 ? <TxRow k="Net investment income tax" v={R.niit} eff={share(R.niit)} c={SERIES.gray} /> : null}
        {stateRow}
        {totals("Income after tax", "Gross withdrawals")}
      </>
    );
  }

  // ---- retirement mode: each source, and where the gain landed
  type Bucket = { label: string; withdrawn: number; taxable: number; federal: number; state: number; tax: number; eff: number };
  const live = ret ? (R.buckets as Bucket[]).map((b, i) => ({ b, c: BKT_COLORS[i] })).filter((o) => o.b.withdrawn > 0) : [];
  const maxAmt = live.reduce((a, o) => Math.max(a, o.b.withdrawn), 0);
  let bucketNote = "", gainNote = "";
  if (ret) {
    bucketNote = "The Roth column is zero by construction, and only the gain portion of the brokerage withdrawal is taxable; the rest is your own basis coming back. " +
      "Ordinary tax is split across the traditional, Social Security and other-income rows in proportion to what each contributed to ordinary taxable income.";
    if (R.ssGross > 0)
      bucketNote += " Your provisional income is " + money(R.provisional) + ", which puts " +
        (R.ssTier === 0 ? "none of your benefits in the tax base." : "up to " + R.ssTier + "% of your benefits in the tax base: " + money(R.taxableSS) + " of " + money(R.ssGross) + ".");
    if (R.stateNote) {
      bucketNote += " <b>" + (R.stateName || "This state") + ".</b> " + R.stateNote;
      if (R.stateExcluded > 0) bucketNote += " That removed " + money(R.stateExcluded) + " from the state tax base here.";
    }
    if (R.gain > 0) {
      gainNote = "You realized " + money(R.gain) + " of long-term gain on a " + money(R.brok) + " brokerage withdrawal; " + money(R.basis) + " of that was basis and never touched the return. ";
      gainNote += R.gainTaxable > 0
        ? "The gain sits on top of " + money(R.ordTaxable) + " of ordinary taxable income, so it is taxed at a blended <b>" + pctStr(R.ltcgRate, 1) + "</b>, costing " + money(R.ltcg) + ". "
        : "Your deductions cover everything, so none of the gain is taxable at all. ";
      if (R.zeroRoom > 0) gainNote += "You have <b>" + money(R.zeroRoom) + "</b> of room left in the 0% band: gain harvested up to that point would be federally free.";
      else if (R.ltcgBands[0].amount > 0) gainNote += "The 0% band is now full.";
      if (R.niit > 0)
        gainNote += " Your MAGI of " + money(R.agi) + " is above the " + money((NIIT as { threshold: Record<string, number> }).threshold[inp.status]) +
          " net investment income tax threshold, adding " + money(R.niit) + ".";
    }
  }

  // The answer's tone: amber, unless it has gone below zero (pre-tax savings
  // larger than what's left after tax), which reads as a loss with a glyph
  // and a word, never as the answer.
  const shownNet = ret ? R.net : s.view === "take" ? R.net : R.gross - R.total;
  const negative = shownNet < 0;
  const empty = !(R.gross > 0);
  // With no income yet there's no answer to mark, so the $0 stays in Text.
  const tone = negative ? "loss" : empty ? "text" : "answer";
  // Pre-tax savings can't be more than the income they come out of.
  const preOver = inp.pre > 0 && inp.pre > R.gross;
  // In the Net pay view the bars and donut show take-home pay; say how the
  // two relate, with the figures already on the page.
  const reconcile = !ret && s.view !== "take" && R.pre > 0 && !empty;

  return (
    <div className="col-span-full grid grid-cols-1 items-start gap-5 max-sm:gap-3.5 lg:grid-cols-3">
      <div className="min-w-0 lg:col-span-1 lg:self-stretch">
        {/* Phones and narrow screens: the answer leads, and stays under the
            tab rail while the inputs are on screen. */}
        <PinnedReading tone={tone} main={{ label: head.netLabel, value: head.net }} side={{ label: "Per month", value: head.month }} />

        <aside id="asideTax" className="max-lg:static max-lg:max-h-none max-lg:overflow-visible">
          <Card>
            <CardHeader>
              <CardTitle>Your situation</CardTitle>
              <CardDescription>A year of pay, or a year of withdrawals in retirement.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <Segmented id="segTxMode" size="fill" attr="data-txmode" options={[["normal", "Normal income"], ["retire", "Retirement income"]] as const} value={s.mode} onChange={set("mode")} />
              </div>

              <GroupHead first>Income</GroupHead>
              <div id="txGrossWrap" className={split ? "two bottomalign max-sm:grid-cols-2" : undefined} hidden={ret}>
                <MoneyField id="txGross" labelId="txGrossLabel" label={split ? "Your gross income" : "Gross income"} value={s.gross} onValueChange={set("gross")} />
                <MoneyField id="txGross2" wrapId="txGross2Wrap" hidden={!split} label="Spouse's gross income" value={s.gross2} onValueChange={set("gross2")} />
              </div>
              <div className="derived txtotal" id="txGrossTotalWrap" hidden={!split}>
                <div><span>Household gross income</span><span className="num" id="txGrossTotalShow">{split ? money(R.gross) : ""}</span></div>
              </div>

              <div id="txRetSources" hidden={!ret}>
                <div className="two bottomalign max-sm:grid-cols-2">
                  <MoneyField id="txTrad" label={<Tipped text="Traditional 401(k) / IRA withdrawal" k="bkttrad" />} value={s.trad} onValueChange={set("trad")} />
                  <MoneyField id="txRoth" label={<Tipped text="Roth withdrawal" k="bktroth" />} value={s.roth} onValueChange={set("roth")} />
                </div>
                <div className="two bottomalign max-sm:grid-cols-2">
                  <MoneyField id="txBrok" label={<Tipped text="Brokerage" k="bktbrok" />} value={s.brok} onValueChange={set("brok")} />
                  <NumberField id="txGainPct" label={<Tipped text="Gain portion" k="bktgain" />} unit="%" step={5} max={100} value={s.gainPct} onValueChange={set("gainPct")} />
                </div>
                <div className="two bottomalign max-sm:grid-cols-2">
                  <MoneyField id="txSS" label={<Tipped text="Social Security benefits" k="bktss" />} value={s.ss} onValueChange={set("ss")} />
                  <MoneyField id="txOther" label={<Tipped text="Other ordinary income" k="bktother" />} value={s.other} onValueChange={set("other")} />
                </div>
                <div className="two bottomalign">
                  <MoneyField id="txPension" label={<Tipped text="Pension / annuity" k="bktpen" />} value={s.pension} onValueChange={set("pension")} />
                  <SelectField id="txPenType" label="Payer" value={s.penType} onChange={set("penType")}>
                    <option value="priv">Private employer</option>
                    <option value="pub">Government / public</option>
                  </SelectField>
                </div>
                <div className="derived txtotal">
                  <div><span>Gross retirement income</span><span className="num" id="txRetGross">{ret ? money(R.gross) : ""}</span></div>
                </div>
              </div>

              <GroupHead>Your return</GroupHead>
              {/* Two-up where the answers are short; the selects take the
                  full width on a phone, where half would cut their text. */}
              <div className="grid grid-cols-2 items-end gap-x-2.5 max-sm:grid-cols-1">
                <SelectField id="txStatus" label="Filing status" value={s.status}
                  // "Both spouses" only means anything on a joint return.
                  onChange={(v) => setState((c) => ({ ...c, status: v, seniors: v !== "m" && c.seniors === "2" ? "1" : c.seniors }))}>
                  <option value="s">Single</option>
                  <option value="m">Married filing jointly</option>
                </SelectField>
                <SelectField id="txSeniors" wrapId="txSeniorWrap" hidden={!ret} label={<Tipped text="Age 65 or older" k="senior" />} value={s.seniors} onChange={set("seniors")}>
                  <option value="0">No</option>
                  <option value="1">{joint ? "One spouse" : "Yes"}</option>
                  <option value="2" hidden={!joint} disabled={!joint}>Both spouses</option>
                </SelectField>
                <SelectField id="txState" className={ret ? "col-span-full" : undefined} label="State" value={s.state} onChange={set("state")}>
                  {STATE_OPTIONS.map((o) => <option key={o.code} value={o.code}>{o.name}</option>)}
                </SelectField>
                <MoneyField id="txPre" label={<>Pre-tax deductions<TipDot k={ret ? "txpreret" : "txpre"} /></>} value={s.pre} onValueChange={set("pre")}
                  aria-invalid={preOver || undefined} aria-describedby={preOver ? "txPreWarn" : undefined} />
                <SelectField id="txDedType" label={<Tipped text="Deduction" k="deduction" />} value={s.dedType} onChange={set("dedType")}>
                  <option value="std">Standard deduction</option>
                  <option value="item">Itemized</option>
                </SelectField>
              </div>
              <div className="-mt-1 mb-3.5 flex items-start gap-2 text-note text-destructive" hidden={!preOver}>
                <CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span id="txPreWarn" role="alert">{preOver ? "Pre-tax deductions are more than your gross " + (ret ? "retirement income" : "income") + " (" + money(R.gross) + ")." : ""}</span>
              </div>
              <Field id="txItem" wrapId="txItemWrap" hidden={s.dedType !== "item"} label="Itemized total">
                <Affixed prefix="$"><MoneyInput id="txItem" nonNeg value={s.item} onValueChange={set("item")} /></Affixed>
                <div className="hint">Mortgage interest, charity, and state/local taxes up to the cap.</div>
              </Field>

              <GroupHead>How the federal tax was figured</GroupHead>
              <div className="derived mt-0 border-t-0 pt-0">
                <div id="txSSRow" hidden={derived.ssRow == null}><span><Tipped text="Taxable Social Security" k="ss86" /></span><span className="num" id="txSSShow">{derived.ssRow ?? DASH}</span></div>
                <div><span id="txStdLabel">{derived.stdLabel}</span><span className="num" id="txStdShow">{derived.std}</span></div>
                <div><span>Taxable income</span><span className="num" id="txTaxable">{money(R.fedTaxable)}</span></div>
                <div><span id="txMarginalLabel"><Tipped text="Marginal federal rate" k="marginal" /></span><span className="num" id="txMarginal">{derived.marginal}</span></div>
                <div><span id="txRoomLabel">{derived.roomLabel}</span><span className="num" id="txRoomShow">{derived.room}</span></div>
                <div id="txZeroRoomRow" hidden={derived.zeroRoom == null}><span>Room in the 0% gains rate</span><span className="num" id="txZeroRoomShow">{derived.zeroRoom ?? ""}</span></div>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>

      <div className="stack min-w-0 lg:col-span-2" id="tab-tax">
        <Card size="flush" className="min-w-0">
          {/* Which pay the reading shows, in a quiet toolbar above it. */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border px-5.5 py-3 max-sm:px-4">
            <Segmented id="segTxView" attr="data-view" options={[["net", "Net pay"], ["take", "Take-home pay"]] as const} value={s.view} onChange={set("view")} hidden={ret} />
            <span className="text-label text-muted-foreground" id="txRetLbl" hidden={!ret}>Retirement income</span>
            <span className="ml-auto"><Badge variant="outline">2026 rates</Badge></span>
          </div>
          <HeroReading tone={tone}
            hero={{
              label: head.netLabel, labelId: "txNetLabel", id: "txNet", value: head.net, noteId: "txNetNote",
              note: negative ? (
                <span className="inline-flex items-center gap-1.5">
                  <CircleAlertIcon className="size-3.5 shrink-0 text-destructive" aria-hidden="true" />
                  <span><b className="font-semibold text-foreground">Below zero.</b> {head.netNote}</span>
                </span>
              ) : head.netNote,
            }}
            figures={[
              { label: "Per month", id: "txMonth", value: head.month, noteId: "txMonthNote", note: head.monthNote },
              { label: head.thirdLabel, labelId: "txThirdLabel", id: "txBiweek", value: head.third, noteId: "txThirdNote", note: head.thirdNote },
            ]} />

          <div className="border-t border-border px-5.5 py-5 max-sm:px-4">
            {reconcile ? (
              <p className="mt-0 mb-4 max-w-copy text-note text-muted-foreground tabular-nums" id="txReconcile">
                Net pay counts your {money(R.pre)} of pre-tax savings as yours. The picture shows take-home
                pay, {money(R.net)}: what reaches your paycheck once those savings are set aside.
              </p>
            ) : null}
            {/* The donut is the picture and the bars are its legend; hovering
                either lights the same part in both. */}
            <div className="flex flex-col items-center gap-6 sm:flex-row" hidden={empty}>
              <div className="w-full max-w-55 shrink-0 *:block *:h-auto *:w-full">
                <svg id="txPie" viewBox="0 0 220 220" role="img" aria-label="Share of income by tax and take-home"
                  onMouseOver={(e) => {
                    const c = (e.target as Element).closest("circle[data-idx]");
                    if (c) activate(+(c.getAttribute("data-idx") ?? 0));
                    else leave();
                  }}
                  onMouseLeave={leave}>
                  <Donut parts={parts} center={pctStr(R.effTotal, 1)} active={active} />
                </svg>
              </div>
              <div id="txBars" className="w-full min-w-0 flex-1" onMouseLeave={leave}
                onMouseOver={(e) => {
                  const b = (e.target as Element).closest(".bar[data-idx]");
                  if (b) activate(+(b.getAttribute("data-idx") ?? 0));
                }}>
                {bars.map((b, i) => (
                  <ShareBar key={b.label} label={b.label} value={b.v} share={b.share} color={b.c} idx={i} dim={active != null && active !== i} />
                ))}
              </div>
            </div>
            {empty ? (
              <p className="m-0 text-note text-muted-foreground">{ret ? "Enter a withdrawal to see where each dollar goes." : "Enter your income to see where each dollar goes."}</p>
            ) : null}
          </div>
        </Card>

        <Card id="txGainPanel" hidden={!(ret && R.gain > 0)}>
          <CardHeader><CardTitle>Your capital gain, and which band it landed in<TipDot k="ltcgstack" /></CardTitle></CardHeader>
          <CardContent>
            <div id="txStackWrap">
              <svg id="txStack" viewBox="0 0 720 150" role="img" aria-label="Ordinary income and capital gain stacked against the 0%, 15% and 20% capital gain bands"
                dangerouslySetInnerHTML={{ __html: ret && R.gain > 0 ? stackChartSvg(R) : "" }} />
            </div>
            <div id="txStackLegend" className="stacklegend">
              {ret && R.gain > 0 ? (
                <>
                  <span><i className="bg-series-gray"></i>Ordinary taxable income <b>{money(R.ordTaxable)}</b></span>
                  {(R.ltcgBands as { amount: number; rate: number }[]).map((b, i) => b.amount > 0 ? (
                    <span key={i}><i className="bg-(--swatch)" style={{ "--swatch": LTCG_COLORS[i] } as React.CSSProperties}></i>Gain taxed at {pctStr(b.rate, 0)} <b>{money(b.amount)}</b></span>
                  ) : null)}
                </>
              ) : null}
            </div>
          </CardContent>
          <div className="mcnote" id="txGainNote" dangerouslySetInnerHTML={{ __html: gainNote }} />
        </Card>

        <Card id="txBucketPanel" hidden={!ret}>
          <CardHeader>
            <CardTitle>Where each dollar came from, and how it was taxed</CardTitle>
            <CardDescription>Each track is what you took from that source; the filled part went to tax.</CardDescription>
            <CardAction><CsvButton table={bucketRef} label="Where each dollar came from, and how it was taxed" /></CardAction>
          </CardHeader>
          <CardContent>
            <div id="txBucketBars">
              {live.length ? live.map((o) => {
                // The track is this source's withdrawal against the largest;
                // the filled part is the share of it that went to tax.
                const b = o.b;
                return (
                  <div className="bar" key={b.label}>
                    <div className="lbl"><span>{b.label}</span><b>{money(b.withdrawn) + (b.withdrawn > 0 ? " · " + money(b.tax) + " tax (" + pctStr(b.eff, 1) + ")" : "")}</b></div>
                    <div className="track w-(--w)" style={{ "--w": Math.max(maxAmt > 0 ? (b.withdrawn / maxAmt) * 100 : 0, 1.5).toFixed(1) + "%" } as React.CSSProperties}>
                      <div className={"fill w-(--w) bg-(--swatch)" + hatchClass(o.c)}
                        style={{ "--w": Math.min(100, b.withdrawn > 0 ? (b.tax / b.withdrawn) * 100 : 0).toFixed(1) + "%", "--swatch": baseColor(o.c) } as React.CSSProperties}></div>
                    </div>
                  </div>
                );
              }) : <div className="hint">Enter a withdrawal above to see how it is taxed.</div>}
            </div>
          </CardContent>
          <div className="swipehint">Swipe the table sideways to see every column.</div>
          <div className="scroll">
            <table id="txBucketTable" ref={bucketRef}>
              <thead><tr><th>Source</th><th>Withdrawn</th><th>Taxable</th><th>Federal</th><th>State</th><th>Total tax</th><th><Tipped text="Effective rate" k="effrate" /></th></tr></thead>
              <tbody>
                {live.map((o) => (
                  <tr key={o.b.label}><td><Key c={o.c} /> {o.b.label}</td><td>{money(o.b.withdrawn)}</td><td>{money(o.b.taxable)}</td>
                    <td>{money(o.b.federal)}</td><td>{money(o.b.state)}</td><td>{money(o.b.tax)}</td><td>{pctStr(o.b.eff, 1)}</td></tr>
                ))}
                {ret ? (
                  <tr className="font-semibold border-t-2 border-t-line"><td>All sources</td><td>{money(R.gross)}</td>
                    <td>{money(live.reduce((a, o) => a + o.b.taxable, 0))}</td><td>{money(R.federal)}</td><td>{money(R.state)}</td>
                    <td>{money(R.total)}</td><td>{pctStr(R.effTotal, 1)}</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="mcnote" id="txBucketNote" dangerouslySetInnerHTML={{ __html: bucketNote }} />
        </Card>

        <Card>
          <CardHeader><CardTitle>Tax breakdown</CardTitle><CardAction><CsvButton table={tableRef} label="Tax breakdown" /></CardAction></CardHeader>
          {/* On a phone the repeated Share column steps out and the rest fit,
              so there's nothing to swipe. */}
          <div className="scroll">
            <table id="txTable" ref={tableRef}>
              <thead><tr><th>Item</th><th>Amount</th><th><Tipped text="Effective rate" k="effrate" /></th><th>Share of income</th></tr></thead>
              <tbody>{rows}</tbody>
            </table>
          </div>
        </Card>

        <Card>
          <CardHeader><CardTitle>Federal brackets, and what you pay in each</CardTitle><CardAction><CsvButton table={bracketRef} label="Federal brackets, and what you pay in each" /></CardAction></CardHeader>
          <div className="swipehint">Swipe the table sideways to see every column.</div>
          <div className="scroll">
            <table id="txBrackets" ref={bracketRef}>
              <thead><tr><th>Rate</th><th>Income range</th><th>Taxed in this band</th><th>Tax</th></tr></thead>
              <tbody>
                {(R.bands as { rate: number; lo: number; hi: number; amount: number; tax: number }[]).map((b) => (
                  <tr key={b.rate} className={b.amount > 0 ? undefined : "text-muted-foreground"}>
                    <td>{pctStr(b.rate, 0)}</td><td>{money(b.lo) + (b.hi === Infinity ? " and up" : " – " + money(b.hi))}</td><td>{money(b.amount)}</td><td>{money(b.tax)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* The state's rules fold behind their title; what the figures leave
            out stays in view under them. */}
        <Collapsible className="min-w-0" render={<Card />}>
          <CardHeader>
            <CardTitle><CollapsibleTrigger>State rules, and what went into the figure above<ChevronDownIcon aria-hidden="true" /></CollapsibleTrigger></CardTitle>
            <CardDescription id="txStateRuleName">{STATE_OPTIONS.find((o) => o.code === s.state)?.name ?? ""}</CardDescription>
            <CardAction><CsvButton table={rulesRef} label="State rules, and what went into the figure above" /></CardAction>
          </CardHeader>
          <CollapsibleContent keepMounted>
            <div id="txStateRuleWrap">
              <table id="txStateRules" ref={rulesRef}>
                <tbody>
                  {(stateRuleRows(s.state, s.status) as [string, string][]).map(([k, v]) => (
                    <tr key={k}><td className="whitespace-nowrap font-semibold">{k}</td><td>{v}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CollapsibleContent>
          <div className="mcnote" id="txStateGaps"><b>Not included in the figures above.</b> {stateGaps(s.state)}</div>
        </Collapsible>
      </div>
    </div>
  );
}

/** A heading over one group of the inputs, on a rule after the first (as on
    Advanced). */
function GroupHead({ first, children }: { first?: boolean; children: React.ReactNode }) {
  return <h3 className={cn("m-0 mb-3 text-sm font-semibold", !first && "mt-1 border-t border-border pt-4")}>{children}</h3>;
}
