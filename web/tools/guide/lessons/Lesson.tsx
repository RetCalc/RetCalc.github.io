"use client";

/* A lesson in a card's Learn zone (doc 2, part 4): its title, one idea in a
   few sentences in the person's own figures once they exist, a small live
   figure where one helps, and a line of links: the glossary terms it names,
   each with its "?", and the tools that go deeper. */

import Link from "next/link";
import type { ReactNode } from "react";
import { TipDot } from "@/components/shell/Tooltips";
import { lessonById } from "./index";

export function Lesson({ id, figure, caption, children }: { id: string; figure?: ReactNode; caption?: ReactNode; children: ReactNode }) {
  const L = lessonById(id);
  if (!L) return null;
  return (
    <div className="gd-lesson" data-lesson={id}>
      <h4 className="gd-lesson-t">{L.title}</h4>
      <div className="gd-lesson-b">{children}</div>
      {figure ? <figure className="gd-lesson-fig">{figure}{caption ? <figcaption>{caption}</figcaption> : null}</figure> : null}
      {L.terms.length || L.tools.length ? (
        <p className="gd-lesson-links">
          {L.terms.length ? <span>{L.terms.map((t, i) => <span key={t.key} className="gd-term">{i ? ", " : ""}{t.label}<TipDot k={t.key} title={t.label} /></span>)}</span> : null}
          {L.tools.length ? <span>Goes deeper in {L.tools.map((t, i) => <span key={t.id}>{i ? " and " : ""}<Link href={t.path} data-lesson-tool={t.id}>{t.name}</Link></span>)}</span> : null}
        </p>
      ) : null}
    </div>
  );
}

/** A term in a lesson's own sentence, with its "?". */
export function Term({ k, children }: { k: string; children: ReactNode }) {
  return <span className="gd-term">{children}<TipDot k={k} /></span>;
}
