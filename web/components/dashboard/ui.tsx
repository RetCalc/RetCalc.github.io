"use client";

/* The pieces every dashboard page is built from: a tile, an empty tile, a
   note, and the way a section asks for what it's missing. */

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ChevronDownIcon, InfoIcon, PlusIcon, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { TipDot } from "@/components/shell/Tooltips";
import { TIPS, type TipId } from "./tips";

/** A tile; `id` lets a link land on it ("/dashboard/profile#assumptions");
    `tip`, a "?" after its title explaining it, kept out of the heading so
    the heading reads as its title alone. */
export function Tile({ icon: Icon, title, right, className, id, tip, tipK, children }: { icon: LucideIcon; title: string; right?: ReactNode; className?: string; id?: string; tip?: TipId; tipK?: string; children: ReactNode }) {
  return (
    <section id={id} className={className ? "dsh-tile " + className : "dsh-tile"}>
      <div className="dsh-tile-h"><span className="dsh-ti"><Icon aria-hidden="true" /></span>{tip || tipK ? <span className="dsh-tile-t"><h2>{title}</h2><Tip id={tip} k={tipK} title={title} /></span> : <h2>{title}</h2>}{right ? <div className="dsh-r">{right}</div> : null}</div>
      {children}
    </section>
  );
}

/** A "?" with one of the Dashboard's explanations (tips.ts), or the site
    glossary's entry `k`; `title` names it for screen readers and heads the
    sheet it opens on a phone. */
export function Tip({ id, k, title }: { id?: TipId; k?: string; title: string }) {
  return <TipDot k={k ?? ""} title={title} text={id ? TIPS[id] : undefined} />;
}

/** A field's label ending in a "?", its last word kept with the dot so a
    narrow column never leaves the dot alone on a line. */
export function TipLabel({ text, id, k }: { text: string; id?: TipId; k?: string }) {
  const m = text.match(/^([\s\S]*?)(\S+\s*)$/);
  return <>{m ? m[1] : ""}<span className="tipglue">{m ? m[2] : text} <Tip id={id} k={k} title={text} /></span></>;
}

/** A tile with nothing to show yet: what it will show, and the one thing that fills it. */
export function Empty({ icon, title, ghost, text, action, href }: { icon: LucideIcon; title: string; ghost: string; text: string; action: string; href: string }) {
  return (
    <Tile icon={icon} title={title} className="dsh-empty">
      <div className="dsh-ghostfig dsh-mt">{ghost}</div>
      <p>{text}</p>
      <div className="dsh-foot"><Button variant="outline" size="sm" nativeButton={false} render={<Link href={href} />}><PlusIcon aria-hidden="true" />{action}</Button></div>
    </Tile>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return <div className="dsh-note"><InfoIcon aria-hidden="true" /><span>{children}</span></div>;
}

/** A label and its figure, side by side with others in a row. */
export function Stat({ label, value, sub, keyFig }: { label: ReactNode; value: ReactNode; sub?: ReactNode; keyFig?: boolean }) {
  return (
    <div className="dsh-stat">
      <div className="dsh-label">{label}</div>
      <div className={keyFig ? "dsh-fig dsh-key" : "dsh-fig"}>{value}</div>
      {sub ? <div className="dsh-cap dsh-mt6">{sub}</div> : null}
    </div>
  );
}

/** A link inside a sentence, to where a figure is changed. */
export function To({ href, children }: { href: string; children: ReactNode }) {
  return <Button variant="link" size="inline" nativeButton={false} render={<Link href={href} />}>{children}</Button>;
}

/** Figures a tool takes from the plan, said in place of its fields (the
    tool can't change them), with a line saying where each is changed. */
export function PlanFacts({ rows, note, id }: { rows: [ReactNode, ReactNode][]; note?: ReactNode; id?: string }) {
  return (
    <div className="dsh-payfacts" id={id}>
      <dl className="dsh-facts">{rows.map(([k, v], i) => <div key={i}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      {note ? <p className="dsh-cap dsh-mt6">{note}</p> : null}
    </div>
  );
}

/** A section folded to one line: its name and what it comes to, opened
    for the whole of it. Closed until asked for; everything stays a click
    away. */
export function Fold({ icon: Icon, title, summary, id, className, children }: { icon: LucideIcon; title: string; summary: ReactNode; id?: string; className?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="dsh-fold" id={id}><Collapsible open={open} onOpenChange={setOpen}>
      <section className="dsh-tile dsh-fold-h">
        <h2>
          <CollapsibleTrigger variant="row">
            <span className="dsh-ti"><Icon aria-hidden="true" /></span>
            <span className="dsh-fold-n"><span className="dsh-fold-title">{title}</span><span className="dsh-cap">{summary}</span></span>
            <span className="dsh-fold-a" aria-hidden="true">{open ? "Hide" : "Show"}</span>
            <ChevronDownIcon aria-hidden="true" />
          </CollapsibleTrigger>
        </h2>
      </section>
      <CollapsibleContent><div className={className ? "dsh-fold-b " + className : "dsh-fold-b"}>{children}</div></CollapsibleContent>
    </Collapsible></div>
  );
}
