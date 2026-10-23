"use client";

/* The pieces every dashboard page is built from: a tile, an empty tile, a
   note, and the way a section asks for what it's missing. */

import Link from "next/link";
import type { ReactNode } from "react";
import { InfoIcon, PlusIcon, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Tile({ icon: Icon, title, right, className, children }: { icon: LucideIcon; title: string; right?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section className={className ? "dsh-tile " + className : "dsh-tile"}>
      <div className="dsh-tile-h"><span className="dsh-ti"><Icon aria-hidden="true" /></span><h2>{title}</h2>{right ? <div className="dsh-r">{right}</div> : null}</div>
      {children}
    </section>
  );
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
