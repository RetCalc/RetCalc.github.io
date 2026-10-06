"use client";

/* One stage of the Stages calculator: its length, contribution (or the
   three account amounts when split by account type), frequency, growth and
   return, and on the last stage a glide path. From buildStages() and
   stageGridHtml() in src/js/app/08-stages.js. */

import { useState } from "react";
import { CircleAlertIcon } from "lucide-react";
import { CheckToggle, SignFlip } from "@/components/fields/CheckToggle";
import { MoneyInput, NumberInput } from "@/components/fields/NumberInput";
import { useToast } from "@/components/shell/Toast";
import { TipDot, Tipped } from "@/components/shell/Tooltips";
import { ConvertIcon, ConverterDialog, GrowthRatesDialog } from "@/components/tools/ContribDialogs";
import { StageHead } from "@/components/tools/StageHead";
import { groupDigits, parseNum, pctStr } from "@/lib/format";
import { PeriodOptions } from "@/lib/periods";
import { glideNote, pctField } from "@/tools/advanced/model";
import { stageGlideYears, stageGrowthBlend, stageSplit, type StageInputs, type StageNum } from "./model";
import { Button } from "@/components/ui/button";
import { Affixed } from "@/components/fields/Field";
import { InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Checkbox } from "@/components/ui/checkbox";

export type StageEdit = (i: number, f: (st: StageInputs) => StageInputs) => void;

interface Props {
  i: number; st: StageInputs; num: StageNum; last: boolean; split: boolean; mc: boolean;
  /** With per-account growth, the blended rate the stage runs on. */
  blend?: number;
  span: string; adjNote: string; fees: number; inflation: number; matchOn: boolean;
  edit: StageEdit; remove: (i: number) => void;
}

export function StageCard({ i, st, num, blend, last, split, mc, span, adjNote, fees, inflation, matchOn, edit, remove }: Props) {
  const [dialog, setDialog] = useState<"conv" | "growth" | null>(null);
  const toast = useToast();
  const label = st.name || "Stage " + (i + 1);
  const aria = "Stage " + (i + 1);
  const up = (f: (st: StageInputs) => StageInputs) => edit(i, f);
  const setF = (k: keyof StageInputs) => (v: string) => up((c) => ({ ...c, [k]: v }));

  /* The split amounts are the stage's total and its split. */
  const sp = stageSplit(st);
  const amt = (x: number) => groupDigits(Math.round(parseNum(st.contrib) * x * 100) / 100, true);
  const shown = { cT: st.cT ?? amt(sp.t), cR: st.cR ?? amt(sp.r), cB: st.cB ?? amt(sp.b) };
  const setSplit = (k: "cT" | "cR" | "cB") => (v: string) => up((c) => {
    const typed = { ...shown, [k]: v };
    const t = parseNum(typed.cT), r = parseNum(typed.cR), b = parseNum(typed.cB), sum = t + r + b;
    return { ...c, ...typed, contrib: String(sum), ...(sum > 0 ? { sTrad: t / sum, sRoth: r / sum } : {}) };
  });

  const blended = split && !!st.gRates;
  // A stage with no years adds nothing; say so at the field (the figures
  // still follow what's typed).
  const noYears = st.years.trim() !== "" && !(num.years > 0);
  const errId = "stageYearsErr" + i;
  const adjRow = i > 0 ? (
    <label className="-mt-1.5 mb-3.5 flex min-w-0 cursor-pointer items-center gap-2 text-label text-muted-foreground" title="Inflation adjusted: grows the amount you type by inflation up to the start of this stage">
      <Checkbox data-f="adj" data-i={i} checked={st.adj} onCheckedChange={(on) => up((c) => ({ ...c, adj: on }))} />
      <span className="min-w-0 truncate">Inflation adjusted</span>
      <span className="ml-auto shrink-0 tabular-nums empty:hidden" data-adj={i}>{adjNote}</span>
    </label>
  ) : null;

  const field = (key: string, labelText: React.ReactNode, input: React.ReactNode, extra?: React.ReactNode, cls?: string) => (
    <div className={cls ? "field " + cls : "field"} key={key}><Label className="mb-1.5"><span>{labelText}</span></Label>{input}{extra}</div>
  );
  const years = field("years", "Years", <Affixed suffix="yrs"><NumberInput data-f="years" data-i={i} nonNeg value={st.years} aria-label={aria + " years"}
    aria-invalid={noYears || undefined} aria-describedby={noYears ? errId : undefined}
    onValueChange={(v) => up((c) => ({ ...c, years: v, ...(c.glideYears !== "" ? { glideYears: stageGlideYears(v, c.glideYears) } : {}) }))} /></Affixed>);
  const rate = field("rate", <Tipped text="Rate of return" k="nominalreturn" />, <Affixed suffix="%">
    <SignFlip value={st.nominal} onFlip={setF("nominal")} />
    <NumberInput data-f="nominal" data-i={i} step={0.5} value={st.nominal} aria-label={aria + " rate of return"} onValueChange={setF("nominal")} />
    </Affixed>,
  <div className="hint mt-1 mx-0 mb-0" data-realrate={i}>{pctStr((1 + num.nominal - fees) / (1 + inflation) - 1, 2) + " Real"}</div>);
  const contrib = field("contrib", "Contribution", <Affixed prefix="$"><MoneyInput data-f="contrib" data-i={i} nonNeg value={st.contrib} aria-label={aria + " contribution"} onValueChange={setF("contrib")} /></Affixed>);
  const freq = field("freq", "How often", <NativeSelect data-f="period" data-i={i} aria-label={aria + " frequency"} value={st.period} onChange={(e) => setF("period")(e.target.value)}><PeriodOptions /></NativeSelect>,
    <Button variant="link" size="inline-xs" className="mt-1.75 justify-self-start" data-conv={i} onClick={() => setDialog("conv")}>{ConvertIcon}Convert</Button>);
  const growth = field("growth", <Tipped text="Contribution growth" k="contribgrowth" />, <Affixed suffix="%/yr">
    <NumberInput data-f="growth" data-i={i} step={0.5} aria-label={aria + " contribution growth"}
      value={blended ? (blend != null ? String(+(blend * 100).toFixed(2)) : "") : st.growth} onValueChange={setF("growth")}
      readOnly={blended} title={blended ? "Blended from your per-account rates. Click to edit." : undefined}
      onClick={() => blended && setDialog("growth")} />
    </Affixed>,
  split ? <Button variant="link" size="inline-xs" className="mt-1.75 justify-self-start" data-grate={i} onClick={() => setDialog("growth")}>{st.gRates ? "Edit by account" : "Set by account"}</Button> : null);
  const vol = field("vol", "Volatility", <Affixed suffix="%/yr"><NumberInput data-f="vol" data-i={i} nonNeg value={st.vol} aria-label={aria + " volatility"} onValueChange={setF("vol")} /></Affixed>,
    undefined, mc ? "stagevol" : "stagevol hidden");
  const acct = (k: "cT" | "cR" | "cB", lbl: string) => field(k, lbl, <Affixed prefix="$">
    <MoneyInput data-f={k} data-i={i} nonNeg value={shown[k]} aria-label={aria + " " + lbl + " contribution"} onValueChange={setSplit(k)} /></Affixed>);

  /* Defaults to 3 points below this stage's own rate over its final 5 years,
     worked out afresh each time it's turned on. */
  const toggleGlide = () => up((c) => c.glideOn ? { ...c, glideOn: false } : {
    ...c, glideOn: true,
    glideEnd: pctField(Math.max(0, parseNum(c.nominal) - 3) / 100),
    glideYears: String(Math.min(5, Math.max(1, Math.round(Math.min(100, parseNum(c.years)))))),
  });

  /* Flat rows in the inputs column, on a rule between stages: the stage's
     length and return (and on the final stage its glide path), then what it
     puts in. Two fields a row on every width. */
  const row = "two bottomalign max-sm:grid-cols-2";
  return (
    <div className="stagecard m-0 rounded-none border-x-0 border-t border-b-0 border-border bg-transparent px-0 pt-3.5 pb-1 first:border-t-0 first:pt-0" id={"stage" + i}>
      <StageHead name={st.name} fallback={"Stage " + (i + 1)} aria={aria} span={span} remove={() => remove(i)} quiet
        attrs={{ name: { "data-name": i }, span: { "data-span": i }, del: { "data-del": i } }}
        rename={(name) => up((c) => {
          const { name: _old, ...rest } = c;
          return name ? { ...rest, name } : rest;
        })} />
      <div className={row}>{years}{rate}</div>
      {noYears ? (
        <div className="-mt-1.5 mb-3 flex items-start gap-2 text-note text-destructive">
          <CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span id={errId}>This stage has no years, so it adds nothing to the plan.</span>
        </div>
      ) : null}
      {last ? (
        <div className="mb-3.5 -mt-1">
          <CheckToggle on={st.glideOn} onToggle={toggleGlide}>Glide path<TipDot k="glide" /></CheckToggle>
          <div className="glidefields" hidden={!st.glideOn}>
            <div className="two max-sm:grid-cols-2">
              {field("glideEnd", "End at", <Affixed suffix="%">
                <NumberInput data-f="glideEnd" data-i={i} value={st.glideEnd} aria-label={aria + " glide end rate"} onValueChange={setF("glideEnd")} /></Affixed>)}
              {field("glideYears", "Over final", <Affixed suffix="yrs">
                <NumberInput data-f="glideYears" data-i={i} nonNeg value={st.glideYears} aria-label={aria + " glide years"}
                  onValueChange={(v) => up((c) => ({ ...c, glideYears: stageGlideYears(c.years, v) }))} /></Affixed>)}
            </div>
            <div className="hint m-0" data-glidenote={i}>{st.glideOn ? glideNote(num.nominal, num.glide?.endRate || 0, num.years, num.glide?.years || 1, " of this stage") : ""}</div>
          </div>
        </div>
      ) : null}
      {split ? (
        <>
          <div className={row}>{acct("cT", "Traditional")}{acct("cR", "Roth")}</div>
          <div className={row}>{acct("cB", "Taxable")}
            {field("total", "Total", <Affixed prefix="$">
              <InputGroupInput variant="numeric" type="text" readOnly tabIndex={-1} data-stotal={i} aria-label={aria + " total contribution"} value={groupDigits(Math.round(parseNum(st.contrib) * 100) / 100, true)} /></Affixed>)}</div>
          {adjRow}
          <div className={row}>{freq}{growth}</div>
        </>
      ) : (
        <>
          <div className={row}>{contrib}{freq}</div>
          {adjRow}
          <div className={row}>{growth}{vol}</div>
        </>
      )}
      {split ? <div className={row}>{vol}</div> : null}

      {dialog === "conv" ? (
        <ConverterDialog title={label + " contribution"} amount={num.contrib} period={st.period} onClose={() => setDialog(null)}
          apply={(v, period) => up((c) => {
            if (!split) return { ...c, contrib: groupDigits(v, true), period };
            // split by account: scale each account, in whole dollars
            const t = Math.round(v * sp.t), r = Math.round(v * sp.r), b = Math.round(v * sp.b), sum = t + r + b;
            const { cT: _t, cR: _r, cB: _b, ...rest } = c;
            return { ...rest, contrib: groupDigits(sum, true), period, ...(sum > 0 ? { sTrad: t / sum, sRoth: r / sum } : {}) };
          })} />
      ) : null}
      {dialog === "growth" && split ? (
        <GrowthRatesDialog title={label + " contribution growth"} onClose={() => setDialog(null)}
          init={st.gRates || { t: num.growth, r: num.growth, b: num.growth }}
          blend={(rates) => stageGrowthBlend(num, fees, rates)}
          note={matchOn ? "Your employer match rises at the blended rate." : ""}
          apply={(rates) => {
            up((c) => {
              if (rates) return { ...c, gRates: rates };
              const { gRates: _g, ...rest } = c;
              return { ...rest, growth: pctField(blend ?? num.growth) };
            });
            toast(rates ? "Contribution growth set by account" : "One contribution growth rate for every account");
          }} />
      ) : null}
    </div>
  );
}
