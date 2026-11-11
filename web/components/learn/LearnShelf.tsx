/* The top of the Learn home on the site (owner's pick of three, 2026-11-11):
   a deep blue stage with the title, a line on what Learn is, the counts,
   and the eight tracks as book spines, each as tall as its number of
   lessons; each opens its track below (LearnHome listens for the click
   and for a #track-… address). The Dashboard's Learn tab keeps the Dashboard's own title bar. */

import { GraduationCapIcon } from "lucide-react";
import { TRACKS } from "@/lib/learn/catalog";
import type { LessonSummary } from "@/lib/learn/lessons";

/** Short names that fit on a spine. */
const SPINE: Record<string, string> = {
  foundations: "Foundations", saving: "Saving", investing: "Investing", withdrawing: "Withdrawing",
  taxes: "Taxes", social: "Social Security", early: "Retiring early", decisions: "Big decisions",
};

export function LearnShelf({ lessons }: { lessons: LessonSummary[] }) {
  const max = Math.max(...TRACKS.map((t) => t.lessons.length));
  const hours = Math.round(lessons.reduce((a, l) => a + l.minutes, 0) / 60);
  return (
    <header className="lrn-shelf">
      <div className="lrn-shelf-t">
        <span className="lrn-shelf-kick"><GraduationCapIcon aria-hidden="true" />Learn</span>
        <h1>Retirement planning, explained</h1>
        <p>How saving, investing, taxes and Social Security fit into a retirement plan, one idea at a time. Each lesson ends with a tool to try it on your own numbers.</p>
        <dl className="lrn-shelf-stats">
          <div><dt>Lessons</dt><dd>{lessons.length}</dd></div>
          <div><dt>Tracks</dt><dd>{TRACKS.length}</dd></div>
          <div><dt>Reading</dt><dd>{hours}<small> hrs</small></dd></div>
        </dl>
      </div>
      <ol className="lrn-spines" aria-label="The tracks">
        {TRACKS.map((t, i) => (
          <li key={t.id}>
            <a className="lrn-spine" href={`#track-${t.id}`} data-track={t.id} aria-label={`${t.name}, ${t.lessons.length} lessons`}
              style={{ "--h": `${42 + 58 * (t.lessons.length / max)}%` } as React.CSSProperties}>
              <b aria-hidden="true">{i + 1}</b><span aria-hidden="true">{SPINE[t.id]}</span><i aria-hidden="true">{t.lessons.length}</i>
            </a>
          </li>
        ))}
      </ol>
    </header>
  );
}
