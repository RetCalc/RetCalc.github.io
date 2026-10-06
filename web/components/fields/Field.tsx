/* The pieces every input panel is built from, so each tool composes them
   instead of repeating the markup. Labels and spacing still use the old
   site's .field markup; the inputs are the design system's.

     <MoneyField id="moPrice" label="Home price" value={s.price} onValueChange={set("price")} />
     <NumberField id="moRate" label="Interest rate" unit="%" step={0.125} ... />
     <Field id="moTerm" label="Length"><select id="moTerm">...</select></Field>
*/

import type { ReactNode, Ref } from "react";
import { InputGroup, InputGroupAddon, InputGroupText } from "@/components/ui/input-group";
import { InGroup, MoneyInput, NumberInput } from "./NumberInput";
import { Label } from "@/components/ui/label";

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

/** An input with its "$" in front and its unit after. The addons follow
    the input in the markup, so Tab reaches the input first; `align` puts
    them on their side. */
export function Affixed({ prefix, suffix, children, className }: { prefix?: ReactNode; suffix?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <InGroup value={true}>
      <InputGroup className={className}>
        {children}
        {prefix ? <InputGroupAddon><InputGroupText>{prefix}</InputGroupText></InputGroupAddon> : null}
        {suffix ? <InputGroupAddon align="inline-end"><InputGroupText>{suffix}</InputGroupText></InputGroupAddon> : null}
      </InputGroup>
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
      <Affixed suffix={unit}><NumberInput ref={inputRef} id={id} nonNeg={!negative} step={step} max={max} {...input} /></Affixed>
    </Field>
  );
}

/** A dropdown, its options as children. */
export function SelectField({ id, label, value, onChange, wrapId, hidden, className, children, ...attrs }:
  Omit<FieldProps, "children"> & { value: string; onChange: (v: string) => void; children: ReactNode; "aria-label"?: string }) {
  return (
    <Field id={id} label={label} wrapId={wrapId} hidden={hidden} className={className}>
      <select id={id} {...attrs} value={value} onChange={(e) => onChange(e.target.value)}>{children}</select>
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
