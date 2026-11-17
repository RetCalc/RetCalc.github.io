"use client";

/* Fitting the words on a phone (under 768px). The tools carry labels, hints
   and notes written for a wide screen; on a phone the inputs and results
   have to fit first. These pieces put the same words behind a tap or in a
   shorter form, on phones only: on a tablet or desktop each one renders
   exactly what it was given, laid out as if it weren't there.

   The rule for choosing: what someone needs to fill in a field or read a
   figure correctly stays visible (units, per year or per month, before or
   after tax, today's dollars or future ones, warnings, figures people act
   on). Background, method and sources go behind a tap. Nothing is deleted:
   every word a desktop shows is reachable on a phone, and a phone's
   shorter wording must mean the same thing.

     <Short phone="Benefit">Annual benefit at the age you claim</Short>
        The long words on wide screens, the short ones on a phone.

     <p className="hint max-phone:hidden">{WHY}</p> ... <InfoTap title="Withdrawal rate">{WHY}</InfoTap>
        A phone-only ⓘ that opens the same text in a bottom sheet. Put it
        beside the label, and hide the desktop paragraph on phones with
        max-phone:hidden.

     <TapNote label="How this is worked out">...the note as it is...</TapNote>
        Wraps a note where it stands. Desktop: the note, untouched. Phone:
        a small button with that label, which opens the note in a sheet.

     <PhoneFold label="More options" count={5}>...fields as they are...</PhoneFold>
        Wraps a block where it stands. Desktop: the block, untouched.
        Phone: folded behind a row with that label; a tap opens it in place.

   Styles: styles/phone/05-words.css. */

import { useId, useState, type ReactNode } from "react";
import { ChevronDownIcon, InfoIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/** The long wording on wide screens, the short one on a phone. */
export function Short({ phone, children }: { phone: ReactNode; children: ReactNode }) {
  return (
    <>
      <span className="max-phone:hidden">{children}</span>
      <span className="phone:hidden">{phone}</span>
    </>
  );
}

function NoteSheet({ open, setOpen, title, children }: { open: boolean; setOpen: (v: boolean) => void; title: ReactNode; children: ReactNode }) {
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent aria-describedby={undefined}>
        <SheetHeader><SheetTitle>{title}</SheetTitle></SheetHeader>
        <SheetBody><div className="pnote">{children}</div></SheetBody>
        <SheetFooter><Button onClick={() => setOpen(false)}>Done</Button></SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/** A phone-only ⓘ beside a label: a tap opens `children` in a bottom sheet
    titled `title`. Nothing at all on a tablet or desktop. */
export function InfoTap({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={cn("pinfo phone:hidden", className)} aria-label={"About " + title} aria-haspopup="dialog"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}>
        <InfoIcon aria-hidden="true" />
      </button>
      <NoteSheet open={open} setOpen={setOpen} title={title}>{children}</NoteSheet>
    </>
  );
}

/** A note, where it stands. Desktop: the note itself. Phone: a button with
    `label` that opens the note in a sheet titled `title` (or the label).
    `inline` when it sits inside a line of text or a label. */
export function TapNote({ label, title, children, inline, className }: { label: ReactNode; title?: string; children: ReactNode; inline?: boolean; className?: string }) {
  const [open, setOpen] = useState(false);
  const Wrap = inline ? "span" : "div";
  return (
    <>
      <Wrap className="max-phone:hidden phone:contents">{children}</Wrap>
      <button type="button" className={cn("ptap phone:hidden", className)} aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <InfoIcon aria-hidden="true" /><span>{label}</span>
      </button>
      {open ? <NoteSheet open={open} setOpen={setOpen} title={title ?? (typeof label === "string" ? label : "More about this")}>{children}</NoteSheet> : null}
    </>
  );
}

/** A block, where it stands. Desktop: the block itself. Phone: folded
    behind a row with `label` (and `sub`, a line saying what's inside, or
    `count`, how many things are); a tap opens it in place. `open` starts
    it open. */
export function PhoneFold({ label, sub, count, children, open: startOpen = false, className }: {
  label: ReactNode; sub?: ReactNode; count?: number; children: ReactNode; open?: boolean; className?: string;
}) {
  const [open, setOpen] = useState(startOpen);
  const id = useId();
  return (
    <div className={cn("pfold phone:contents", className)} data-open={open ? "" : undefined}>
      <button type="button" className="pfold-t phone:hidden" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        <span className="pfold-l"><b>{label}</b>{sub ? <small>{sub}</small> : null}</span>
        {count != null ? <span className="pfold-n">{count}</span> : null}
        <ChevronDownIcon aria-hidden="true" />
      </button>
      <div className="pfold-b phone:contents" id={id}>{children}</div>
    </div>
  );
}
