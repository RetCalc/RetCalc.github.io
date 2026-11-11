/* The pieces every input panel is built from, so each tool composes them
   instead of repeating the markup. Labels and spacing still use the old
   site's .field markup; the inputs are the design system's.

     <MoneyField id="moPrice" label="Home price" value={s.price} onValueChange={set("price")} />
     <NumberField id="moRate" label="Interest rate" unit="%" step={0.125} ... />
     <Field id="moTerm" label="Length"><NativeSelect id="moTerm">...</NativeSelect></Field>
*/

import { Children, isValidElement, type ReactNode, type Ref } from "react";
import { InputGroup, InputGroupAddon, InputGroupText } from "@/components/ui/input-group";
import { InGroup, InPercent, MoneyInput, NumberInput } from "./NumberInput";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

interface FieldProps {
  /** The input's id, which the label points at. */
  id?: string;
  label: ReactNode;
  /** An id for the label, when its words change with the inputs. */
  labelId?: string;
  /** An id for the field itself, when something shows or hides it. */
  wrapId?: string;
  hidden?: boolean;
  className?: string;
  children: ReactNode;
}

export function Field({ id, label, labelId, wrapId, hidden, className, children }: FieldProps) {
  return (
    <div className={className ? `field ${className}` : "field"} id={wrapId} hidden={hidden}>
      <Label className="mb-1.5" htmlFor={id} id={labelId}><span>{label}</span></Label>
      {children}
    </div>
  );
}

/* A field is no wider than what goes in it needs (its largest answer and
   its unit, with room to spare), so a two-digit age doesn't sit in a box
   that would take a sentence: the width hints at the answer, as GOV.UK's
   fixed-width inputs and Baymard's form research advise. Never narrower
   than 9 characters, and never wider than its column (InputGroup and
   NativeSelect's `fit`). */

/** Characters a number field's longest answer takes, from its `max` and
    `step` (a percent field without a max goes to 100), with its unit. */
function numberChars(max: number | undefined, step: number | undefined, unit: string | undefined, negative: boolean | undefined): number | null {
  const top = max ?? (unit?.startsWith("%") ? 100 : undefined);
  if (top == null || !isFinite(top)) return null;
  const digits = String(Math.floor(Math.abs(top))).length;
  const decimals = step != null && step % 1 !== 0 ? (String(step).split(".")[1]?.length ?? 0) + 1 : 0;
  return digits + decimals + (negative ? 1 : 0) + (unit ? unit.length + 1 : 0);
}

/** Characters a dropdown's longest choice takes, when every choice is short
    words or a number; null (full width) otherwise. */
const SHORT_CHOICE = 14;
function choiceChars(children: ReactNode): number | null {
  let longest = 0;
  for (const c of Children.toArray(children)) {
    if (!isValidElement<{ children?: ReactNode }>(c)) continue;
    const t = c.props.children;
    if (typeof t !== "string" && typeof t !== "number") return null;
    longest = Math.max(longest, String(t).length);
  }
  return longest && longest <= SHORT_CHOICE ? longest : null;
}

/** An input with its "$" in front and its unit after. The addons follow
    the input in the markup, so Tab reaches the input first; `align` puts
    them on their side. `fit`: the characters its longest answer takes. */
export function Affixed({ prefix, suffix, action, children, className, fit }: { prefix?: ReactNode; suffix?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; fit?: number | null }) {
  return (
    <InGroup value={true}>
      <InPercent value={typeof suffix === "string" && suffix.startsWith("%")}>
      <InputGroup className={className} fit={fit}>
        {children}
        {prefix ? <InputGroupAddon><InputGroupText>{prefix}</InputGroupText></InputGroupAddon> : null}
        {suffix ? <InputGroupAddon align="inline-end"><InputGroupText>{suffix}</InputGroupText></InputGroupAddon> : null}
        {/* A button at the end of the field (an InputGroupButton). */}
        {action ? <InputGroupAddon align="inline-end">{action}</InputGroupAddon> : null}
      </InputGroup>
      </InPercent>
    </InGroup>
  );
}

interface ValueProps {
  value: string;
  onValueChange: (v: string) => void;
  "aria-label"?: string;
  placeholder?: string;
  disabled?: boolean;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  /** An answer that can't be used: the field takes the Loss edge, and
      aria-describedby points at the message that says why. */
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

/** A dollar amount: "$" in front, commas as you type, never negative. */
export function MoneyField({ id, label, labelId, unit, wrapId, hidden, className, ...input }: Omit<FieldProps, "children"> & ValueProps & { unit?: string }) {
  return (
    <Field id={id} label={label} labelId={labelId} wrapId={wrapId} hidden={hidden} className={className}>
      <Affixed prefix="$" suffix={unit}><MoneyInput id={id} nonNeg {...input} /></Affixed>
    </Field>
  );
}

/** A plain number with its unit after it, stepped by the arrow keys. Never
    negative unless `negative` says it can be. */
export function NumberField({ id, label, unit, step, max, wrapId, hidden, className, inputRef, negative, ...input }:
  Omit<FieldProps, "children"> & ValueProps & { unit?: string; step?: number; max?: number; inputRef?: Ref<HTMLInputElement>; negative?: boolean }) {
  return (
    <Field id={id} label={label} wrapId={wrapId} hidden={hidden} className={className}>
      <Affixed suffix={unit} fit={numberChars(max, step, unit, negative)}><NumberInput ref={inputRef} id={id} nonNeg={!negative} step={step} max={max} {...input} /></Affixed>
    </Field>
  );
}

/** A dropdown, its options as children. */
export function SelectField({ id, label, value, onChange, wrapId, hidden, className, children, ...attrs }:
  Omit<FieldProps, "children"> & { value: string; onChange: (v: string) => void; children: ReactNode; "aria-label"?: string }) {
  return (
    <Field id={id} label={label} wrapId={wrapId} hidden={hidden} className={className}>
      <NativeSelect id={id} {...attrs} fit={choiceChars(children)} value={value} onChange={(e) => onChange(e.target.value)}>{children}</NativeSelect>
    </Field>
  );
}

/** A small bold heading between groups of fields ("Buying", "Renting"). */
export function FieldHeading({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={className ? `field ${className}` : "field"}>
      <div className="hint m-0 font-semibold text-text">{children}</div>
    </div>
  );
}
