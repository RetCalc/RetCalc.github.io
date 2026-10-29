"use client";

/* Pay, year by year, for the Social Security estimate: a bar for every
   year of the career at what it counts as in today's wages, the best 35
   (the ones the benefit counts) in sky and the rest dimmed, with the wage
   base drawn where it's in range. A click picks a year and puts the cursor
   in its figure below; the arrows step through the years. Before this year
   the figure is what was earned that year, as paid (as a Social Security
   statement lists it), and stands alone; the tool indexes it to today's
   wages. After it, a figure is in today's dollars and carries forward, the
   raises going on from it (a promotion). This year is the pay in the
   sentence above. Changes are listed under the chart, each removable. */

import { useEffect, useRef, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react";
import { Affixed, Field } from "@/components/fields/Field";
import { MoneyInput, NumberInput } from "@/components/fields/NumberInput";
import { Segmented } from "@/components/common/Readout";
import { TipDot } from "@/components/shell/Tooltips";
import { fmtAxisMoney } from "@/components/charts/scale";
import { groupDigits, money, parseNum } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ssRules, type Person, type PersonInputs, type Who } from "./model";

const TIP_PAY = "Every year of your career. Click a bar to change that year. For past years, type what you actually earned that year, as your Social Security statement at ssa.gov/myaccount lists it. Social Security raises past pay by how much average wages have grown since, and the bars show it that way. For future years, type pay in today's dollars. A change carries forward, so later years rise from it, as for a promotion or a cut.";

function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(900);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

export function PayYears({ who, setWho, both, inputs, person, setP, setEdits }: {
  who: Who; setWho: (w: Who) => void;
  /** Both people's benefits are estimated from pay, so the switch shows. */
  both: boolean;
  inputs: PersonInputs; person: Person;
  setP: (k: keyof PersonInputs) => (v: string) => void;
  setEdits: (f: (e: Record<string, string>) => Record<string, string>) => void;
}) {
  const L = person.career ?? [];
  const [sel, setSel] = useState<number | null>(null);
  const valRef = useRef<HTMLInputElement>(null);
  const [boxRef, W] = useWidth<HTMLDivElement>();
  const nowAge = L.find((y) => y.now)?.age;
  const age = sel != null && L.some((y) => y.age === sel) ? sel : nowAge ?? L[Math.floor(L.length / 2)]?.age ?? 0;
  const s = L.find((y) => y.age === age);
  // The figure as typed, while typing; otherwise the year's own.
  const [draft, setDraft] = useState<{ age: number; who: Who; text: string } | null>(null);
  if (!s) return null;

  const { cap } = ssRules();
  const narrow = W < 600, H = narrow ? 150 : 176, pl = narrow ? 38 : 50, pr = 6, pt = 16, pb = 22;
  const top = Math.max(...L.map((y) => y.pay));
  const maxV = Math.max(40000, top * 1.25, top > cap * .8 ? cap * 1.08 : 0), capOn = cap <= maxV;
  const bw = (W - pl - pr) / L.length, Y = (v: number) => pt + (1 - Math.min(v, maxV) / maxV) * (H - pt - pb);
  const step = maxV > 160000 ? 50000 : maxV > 80000 ? 25000 : 20000;
  const ticks: number[] = [];
  for (let v = 0; v < maxV; v += step) ticks.push(v);

  const pick = (a: number, focus = false) => {
    setSel(a);
    setDraft(null);
    if (focus) requestAnimationFrame(() => { valRef.current?.focus(); valRef.current?.select(); });
  };
  const i = L.findIndex((y) => y.age === age);
  const setPay = (text: string) => {
    setDraft({ age, who, text });
    if (s.now) setP("pay")(text);
    else setEdits((e) => ({ ...e, [String(age)]: text }));
    // Past years are typed as earned; future years in today's dollars.
  };
  const edits = Object.keys(inputs.edits).filter((k) => inputs.edits[k] !== "").map(Number).sort((a, b) => a - b);
  const gAhead = parseNum(inputs.gAhead);
  const counts = Math.abs(s.pay - s.earned) >= 1 ? ` Counts as ${money(s.pay)} in today's wages.` : "";
  const ctx = s.now ? "Today's pay, the same as in the sentence above." : s.past
    ? (s.edited ? `Earned in ${s.year}, as paid.${counts}` : `Estimated. Type what you earned in ${s.year}, as paid.${counts}`)
    : s.edited ? `In today's dollars. Later years follow this, rising ${gAhead}% per year.` : "In today's dollars. Type a promotion or a cut. Later years follow it.";
  const shown = draft && draft.age === age && draft.who === who ? draft.text : groupDigits(Math.round(s.earned), true);

  return (
    <div className="mt-3 rounded-xl border border-border bg-background" id="ssPay">
      <div className="flex flex-wrap items-end gap-x-3.5 gap-y-2.5 px-3.5 pt-3">
        <h2 className="m-0 mr-auto mb-2 flex items-center gap-1.5 text-aside font-semibold max-sm:basis-full max-sm:mb-0">
          {who === "you" ? "Your pay, year by year" : "Your spouse's pay, year by year"}<TipDot k="" text={TIP_PAY} />
        </h2>
        {both ? <div className="mb-0.5"><Segmented attr="data-who" options={[["you", "You"], ["spouse", "Spouse"]] as const} value={who} onChange={(w) => { setWho(w); setSel(null); setDraft(null); }} /></div> : null}
        <Field id="ssGPast" className="m-0 w-37.5 max-sm:flex-1" label={<span className="tipglue">Raises before today<TipDot k="" text="How much faster than average wages your pay grew each year before today. 2% is a typical career that rose with experience. 0% is pay that only kept up." /></span>}>
          <Affixed suffix="%/yr"><NumberInput id="ssGPast" step={0.5} value={inputs.gPast} onValueChange={setP("gPast")} /></Affixed>
        </Field>
        <Field id="ssGAhead" className="m-0 w-37.5 max-sm:flex-1" label={<span className="tipglue">Raises from today<TipDot k="" text="How much faster than average wages you expect your pay to grow from here. Changes you add below keep rising at this rate." /></span>}>
          <Affixed suffix="%/yr"><NumberInput id="ssGAhead" step={0.5} value={inputs.gAhead} onValueChange={setP("gAhead")} /></Affixed>
        </Field>
      </div>

      <div ref={boxRef} className="touch-pan-y px-3.5 pt-1.5">
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block w-full select-none outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          tabIndex={0}
          // A click picks a year without focusing the chart (no ring around
          // it while the button is held); the keyboard still reaches it by Tab.
          onMouseDown={(e) => e.preventDefault()} aria-label="Pay by year. Left and right arrows pick a year. Enter edits it." id="ssPayChart"
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); pick(L[Math.max(0, Math.min(L.length - 1, i + (e.key === "ArrowRight" ? 1 : -1)))].age); }
            if (e.key === "Enter") { e.preventDefault(); pick(age, true); }
          }}>
          {ticks.map((v) => (
            <g key={v}>
              <line x1={pl} x2={W - pr} y1={Y(v)} y2={Y(v)} className="stroke-border" />
              <text x={pl - 6} y={Y(v) + 4} textAnchor="end" fontSize={11} className="fill-muted-foreground tabular-nums">{fmtAxisMoney(v)}</text>
            </g>
          ))}
          {L.map((y, k) => {
            const x = pl + k * bw, w = Math.max(1, bw - (bw > 6 ? 2 : 1));
            return (
              <g key={y.age}>
                <rect x={x} y={Y(y.pay)} width={w} height={Math.max(1, Y(0) - Y(y.pay))} rx={Math.min(3, w / 3)}
                  className={cn(y.counted ? "fill-series-sky" : "fill-muted-foreground/30", y.counted && !y.past && !y.now && "opacity-70")} />
                {y.pay > cap && capOn ? <rect x={x} y={Y(y.pay)} width={w} height={Y(cap) - Y(y.pay)} className="fill-background opacity-55" /> : null}
                {y.edited ? <circle cx={x + w / 2} cy={Y(y.pay) - 6} r={2.6} className="fill-foreground" /> : null}
                {y.age === age ? <rect x={x - 1.5} y={pt - 4} width={w + 3} height={Y(0) - pt + 4} rx={4} fill="none" className="stroke-foreground" strokeWidth={1.5} /> : null}
                {y.age % 5 === 0 ? <text x={x + w / 2} y={H - 6} textAnchor="middle" fontSize={11} className="fill-muted-foreground tabular-nums">{y.age}</text> : null}
              </g>
            );
          })}
          {capOn ? <line x1={pl} x2={W - pr} y1={Y(cap)} y2={Y(cap)} className="stroke-muted-foreground" strokeDasharray="4 3" strokeWidth={1.2} /> : null}
          {nowAge != null ? (() => {
            const x = pl + L.findIndex((y) => y.now) * bw;
            return (
              <g>
                <line x1={x - 1} x2={x - 1} y1={pt - 12} y2={Y(0)} className="stroke-foreground opacity-70" strokeDasharray="2 3" />
                <text x={x - 5} y={pt - 4} textAnchor="end" fontSize={11} className="fill-muted-foreground">Today</text>
              </g>
            );
          })() : null}
          {L.map((y, k) => (
            <rect key={y.age} x={pl + k * bw} y={pt - 4} width={bw} height={Y(0) - pt + 4} rx={3}
              className="cursor-pointer fill-transparent hover:fill-foreground/7" onClick={() => pick(y.age, true)}>
              <title>{`Age ${y.age}, ${y.year}: ${y.past && Math.abs(y.pay - y.earned) >= 1 ? `earned ${money(y.earned)}, counts as ${money(y.pay)}` : money(y.pay)}${y.counted ? "" : ", not counted"}`}</title>
            </rect>
          ))}
        </svg>
      </div>

      <div className="flex flex-wrap gap-x-3.5 gap-y-1 px-3.5 pt-0.5 pb-2.5 text-label text-muted-foreground">
        <span className="text-foreground">Bars in today&apos;s wages</span>
        <span><i className="mr-1.25 inline-block size-2.25 rounded-xs bg-series-sky align-baseline" />Counted, best 35 years</span>
        <span><i className="mr-1.25 inline-block size-2.25 rounded-xs bg-muted-foreground/30 align-baseline" />Not counted</span>
        <span><i className="mr-1.25 inline-block size-1.5 rounded-full bg-foreground align-middle" />Your change</span>
        {capOn ? <span><i className="mr-1.25 inline-block h-0 w-3.5 border-t-2 border-dashed border-muted-foreground align-middle" />{money(cap)} wage base: pay above it doesn&apos;t count</span> : null}
      </div>

      <div className="flex flex-wrap items-center gap-x-4.5 gap-y-2.5 border-t border-border px-3.5 py-2.5">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
          <Button variant="outline" size="icon-sm" aria-label="Year before" disabled={i <= 0} onClick={() => pick(L[i - 1].age)}><ChevronLeftIcon /></Button>
          <span className="min-w-24 text-center text-note font-semibold" aria-live="polite" id="ssPayYear">Age {s.age}, {s.year}</span>
          <Button variant="outline" size="icon-sm" aria-label="Year after" disabled={i >= L.length - 1} onClick={() => pick(L[i + 1].age)}><ChevronRightIcon /></Button>
          <Affixed prefix="$" suffix="/yr" className="w-37.5">
            <MoneyInput ref={valRef} id="ssPayVal" nonNeg aria-label={s.past ? `Pay earned at age ${s.age}, in ${s.year}` : `Pay at age ${s.age}, in today's dollars`} value={shown} onValueChange={setPay} onBlur={() => setDraft(null)} />
          </Affixed>
          <span className="text-note text-muted-foreground" id="ssPayCtx">{ctx}</span>
          {s.edited ? <Button variant="quiet" size="inline" onClick={() => setEdits((e) => { const n = { ...e }; delete n[String(age)]; return n; })}>Undo</Button> : null}
        </div>
        <span className="ml-auto text-note text-muted-foreground max-sm:ml-0" id="ssPaySum">
          Best 35 years average <b className="font-semibold text-foreground">{money(person.aime * 12)}</b> per year
          {person.years < 35 ? <>, with <b className="font-semibold text-foreground">{35 - person.years}</b> zero year{35 - person.years > 1 ? "s" : ""} averaged in</> : null}
        </span>
      </div>

      {edits.length ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-t border-border px-3.5 pt-2.5 pb-3 text-note" id="ssPayChanges">
          <span className="mr-0.5 text-muted-foreground">Your changes</span>
          {edits.map((a) => (
            <span key={a} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted py-0.5 pr-1 pl-2.5">
              <Button variant="link" size="inline" onClick={() => pick(a, true)}>Age {a}: {money(parseNum(inputs.edits[String(a)]))}{a < person.ageNow ? " earned" : ""}</Button>
              <Button variant="ghost" size="icon-xs" aria-label={`Remove the change at age ${a}`} onClick={() => setEdits((e) => { const n = { ...e }; delete n[String(a)]; return n; })}><XIcon /></Button>
            </span>
          ))}
          <Button variant="quiet" size="inline" onClick={() => setEdits(() => ({}))}>Clear all</Button>
        </div>
      ) : null}
    </div>
  );
}
