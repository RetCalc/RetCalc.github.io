"use client";

/* The household profile's faces. One form (HouseholdForm) is used in two
   places: the household panel, which opens over any page from the header's
   household button (on a phone, the account menu), and About, where it
   sits open under Appearance. Markup from src/main/00-household.html. */

import { useEffect, useRef, useState } from "react";
import { HomeIcon } from "lucide-react";
import { MoneyField, NumberField, SelectField } from "@/components/fields/Field";
import { useToast } from "@/components/shell/Toast";
import { groupDigits, parseOptional } from "@/lib/format";
import { householdSummary, isEmptyHousehold, type Household } from "@/lib/household";
import type { StateOption } from "@/lib/states";
import { useHousehold } from "./HouseholdProvider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";

type Form = Record<"age" | "spouseAge" | "retire" | "saved" | "monthly" | "income" | "income2" | "spend", string> & {
  status: "s" | "m";
  state: string;
};

function toForm(h: Household | null): Form {
  const n = (v: number | null | undefined) => (v == null ? "" : String(v));
  const m = (v: number | null | undefined) => (v == null ? "" : groupDigits(v, true));
  return {
    status: h?.status === "m" ? "m" : "s",
    age: n(h?.age), spouseAge: n(h?.spouseAge), retire: n(h?.retire), state: h?.state ?? "",
    saved: m(h?.saved), monthly: m(h?.monthly), income: m(h?.income), income2: m(h?.income2), spend: m(h?.spend),
  };
}

function fromForm(f: Form): Household {
  const married = f.status === "m";
  return {
    status: f.status,
    age: parseOptional(f.age),
    spouseAge: married ? parseOptional(f.spouseAge) : null,
    retire: parseOptional(f.retire),
    state: f.state || null,
    saved: parseOptional(f.saved),
    monthly: parseOptional(f.monthly),
    income: parseOptional(f.income),
    income2: married ? parseOptional(f.income2) : null,
    spend: parseOptional(f.spend),
  };
}

/** The household's fields, Save (which fills the tools in) and Clear.
    `onDone` runs after a save or clear (the panel closes). */
function HouseholdForm({ states, onDone, autoFocus }: { states: StateOption[]; onDone?: () => void; autoFocus?: boolean }) {
  const { profile, save } = useHousehold();
  const toast = useToast();
  const [form, setForm] = useState<Form>(() => toForm(profile));
  const firstField = useRef<HTMLInputElement>(null);
  const set = <K extends keyof Form>(k: K) => (v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  // The profile is read from the browser after the page loads.
  const savedAt = profile?.savedAt;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- show the stored profile once it's read
    setForm(toForm(profile));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedAt]);
  useEffect(() => {
    if (autoFocus) firstField.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  const onSave = () => {
    const h = fromForm(form);
    if (h.age != null && h.retire != null && h.retire <= h.age) {
      toast("Retire-at age needs to be after your current age first", "warn");
      return;
    }
    const done = save({ ...h, savedAt: Date.now() });
    onDone?.();
    if (!done.length) toast("Saved. Add a few numbers to fill in the tools.");
    else toast(`Filled in ${done.length}${done.length === 1 ? " tool: " : " tools: "}${done.join(", ")}`);
  };

  const onClear = () => {
    if (!isEmptyHousehold(profile) &&
        !confirm("Clear your household profile? Numbers already filled in to each tool stay as they are.")) return;
    save(null);
    setForm(toForm(null));
    onDone?.();
    toast("Household profile cleared");
  };

  return (
    <div className={`hh-body${form.status === "m" ? " married" : ""}`} id="hhBody"
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") {
          e.preventDefault();
          onSave();
        }
      }}>
      <div className="hh-grid">
        <SelectField id="hhStatus" label="Household" value={form.status} onChange={(v) => set("status")(v as Form["status"])}>
          <option value="s">Just me</option>
          <option value="m">Me and a spouse</option>
        </SelectField>
        <NumberField inputRef={firstField} id="hhAge" label="Your age" unit="age" value={form.age} onValueChange={set("age")} />
        <NumberField id="hhSpouseAge" className="hh-sp" label="Spouse's age" unit="age" value={form.spouseAge} onValueChange={set("spouseAge")} />
        <NumberField id="hhRetire" label="Retire at" unit="age" value={form.retire} onValueChange={set("retire")} />
        <SelectField id="hhState" label="State" value={form.state} onChange={set("state")}>
          <option value="">Not set</option>
          {states.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
        </SelectField>
        <MoneyField id="hhSaved" label="Retirement savings" value={form.saved} onValueChange={set("saved")} />
        <MoneyField id="hhMonthly" label="You save each month" value={form.monthly} onValueChange={set("monthly")} />
        <MoneyField id="hhIncome" label="Your gross income" unit="/yr" value={form.income} onValueChange={set("income")} />
        <MoneyField id="hhIncome2" className="hh-sp" label="Spouse's gross income" unit="/yr" value={form.income2} onValueChange={set("income2")} />
        <MoneyField id="hhSpend" label="Spending in retirement" unit="/yr" value={form.spend} onValueChange={set("spend")} />
      </div>
      <div className="hh-foot">
        <div className="hint">Any field can stay blank. Saving fills these numbers in to the
          calculators and the tools that use them. You can still change any tool afterwards
          without touching this. Stored in this browser, and in your account if you sign in.</div>
        <div className="hh-btns">
          <Button variant="outline" className="max-sm:flex-auto" id="hhClear" onClick={onClear}>Clear</Button>{" "}
          {onDone ? <><DialogClose render={<Button variant="outline" className="max-sm:flex-auto" id="hhCancel" />}>Close</DialogClose>{" "}</> : null}
          <Button className="max-sm:flex-auto" id="hhFill" onClick={onSave}>Save and fill in tools</Button>
        </div>
      </div>
    </div>
  );
}

/** About: the form, open under Appearance. */
export function HouseholdBar({ states }: { states: StateOption[]; inAbout?: boolean }) {
  return (
    <section className="hh" id="hhCard" aria-label="Your household">
      <HouseholdForm states={states} />
    </section>
  );
}

/** The household panel, over any page. Rendered once, in the layout. */
export function HouseholdPanel({ states }: { states: StateOption[] }) {
  const { panelOpen, setPanelOpen } = useHousehold();
  return (
    <Dialog open={panelOpen} onOpenChange={setPanelOpen}>
      <DialogContent size="household" aria-labelledby="hhPanelTitle">
        <div className="hh-panel-head">
          <span className="hh-ic" aria-hidden="true"><HomeIcon /></span>
          <div>
            <h2 id="hhPanelTitle">Your household</h2>
            <p>Enter a few details once and every tool starts from your numbers.</p>
          </div>
        </div>
        <HouseholdForm states={states} onDone={() => setPanelOpen(false)} autoFocus />
      </DialogContent>
    </Dialog>
  );
}

/** The header's household button: who's in it at a glance, or an invitation. */
export function HouseholdChip({ states }: { states: StateOption[] }) {
  const { profile, setPanelOpen } = useHousehold();
  const empty = isEmptyHousehold(profile);
  const sum = profile && !empty ? householdSummary(profile, (c) => states.find((s) => s.code === c)?.name) : null;
  const label = sum ? sum.short.slice(0, 2).join(" · ") : "Set up your household";
  return (
    <span className="hh-chip">
      <Button variant="outline" id="btnHousehold" aria-haspopup="dialog"
        aria-label={sum ? "Your household: " + sum.long.join(", ") + ". Edit" : "Set up your household"}
        onClick={() => setPanelOpen(true)}>
        <HomeIcon data-icon="inline-start" aria-hidden="true" />
        <span className="hh-chip-t">{label}</span>
      </Button>
    </span>
  );
}
