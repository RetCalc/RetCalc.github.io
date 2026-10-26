"use client";

/* A lesson, laid out as the approved mock C: the text on the left, and
   beside it Your numbers, Try it, Key terms, Go deeper and "In this lesson"
   (which stays in view while reading and marks the section you're in).
   The lesson counts as read once its "In short" comes into view. */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowRightIcon, CalculatorIcon, CheckIcon, ChevronLeftIcon, ClockIcon, ExternalLinkIcon, ListIcon, BookOpenIcon, RotateCcwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Lesson, LessonSummary, Segment } from "@/lib/learn/lessons";
import type { Track } from "@/lib/learn/catalog";
import { Chart } from "./Chart";
import { Widget } from "./widgets";
import { YoursLine, YoursPanel } from "./Yours";
import { useLearn } from "./progress";
import { hrefIn, learnHome, lessonHref, rewriteLinks, type LearnMode } from "./links";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthOf = (iso: string) => { const [y, m] = iso.split("-"); return `${MONTHS[+m - 1]} ${y}`; };

function Piece({ s, lesson, mode, from }: { s: Segment; lesson: Lesson; mode: LearnMode; from: string }) {
  if (s.kind === "html") return <div dangerouslySetInnerHTML={{ __html: rewriteLinks(mode, s.html, from) }} />;
  if (s.kind === "chart") return <figure className="lrn-fig"><Chart spec={s.spec} label={s.caption.replace(/<[^>]+>/g, "")} />{s.caption ? <figcaption dangerouslySetInnerHTML={{ __html: s.caption }} /> : null}</figure>;
  if (s.kind === "widget") return <figure className="lrn-fig"><Widget name={s.name} label={s.caption.replace(/<[^>]+>/g, "")} />{s.caption ? <figcaption dangerouslySetInnerHTML={{ __html: s.caption }} /> : null}</figure>;
  return lesson.yours ? <YoursLine k={lesson.yours} /> : null;
}

/** "In this lesson", marking the section on screen. */
function Contents({ toc }: { toc: Lesson["toc"] }) {
  const [on, setOn] = useState(toc[0]?.id ?? "");
  useEffect(() => {
    const mark = () => {
      let cur = toc[0]?.id ?? "";
      for (const t of toc) { const h = document.getElementById(t.id); if (h && h.getBoundingClientRect().top < 140) cur = t.id; }
      setOn(cur);
    };
    mark();
    addEventListener("scroll", mark, { passive: true });
    return () => removeEventListener("scroll", mark);
  }, [toc]);
  return (
    <div className="lrn-toc"><Card size="sm">
      <CardHeader><CardTitle><ListIcon aria-hidden="true" />In this lesson</CardTitle></CardHeader>
      <CardContent>
        <nav aria-label="In this lesson"><ol>
          {toc.map((t) => (
            <li key={t.id}><a href={`#${t.id}`} aria-current={t.id === on ? "true" : undefined}
              onClick={(e) => { e.preventDefault(); document.getElementById(t.id)?.scrollIntoView({ behavior: "smooth" }); history.replaceState(null, "", `#${t.id}`); }}>{t.text}</a></li>
          ))}
        </ol></nav>
      </CardContent>
    </Card></div>
  );
}

export function LessonPage({ lesson, next, track, mode }: { lesson: Lesson; next: LessonSummary | null; track: Track; mode: LearnMode }) {
  const router = useRouter();
  const { read, markRead, markUnread } = useLearn();
  const done = !!read[lesson.slug];
  const here = lessonHref(mode, lesson.slug);
  // Unmarked by hand: don't mark it again on this visit.
  const kept = useRef(false);
  const article = useRef<HTMLElement>(null);
  useEffect(() => {
    const end = document.getElementById("short");
    if (!end) return;
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting) && !kept.current) markRead(lesson.slug); }, { rootMargin: "0px 0px -20% 0px" });
    io.observe(end);
    return () => io.disconnect();
  }, [lesson.slug, markRead]);

  const tryHref = hrefIn(mode, "/" + lesson.tool, here);
  const index = track.lessons.indexOf(lesson.slug);
  return (
    <div className="lrn">
      <div className="lrn-crumb">
        <Link href={learnHome(mode)}><ChevronLeftIcon aria-hidden="true" />Learn</Link><span aria-hidden="true">/</span><span>{track.name}</span>
      </div>
      <div className="lrn-lgrid">
        <article ref={article}
          onClick={(e) => {
            const a = (e.target as Element).closest?.("a"), href = a?.getAttribute("href");
            if (!href || !href.startsWith("/") || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
            e.preventDefault();
            router.push(href);
          }}>
          <header className="lrn-lhead">
            <span className="lrn-eyebrow">Lesson {lesson.number} · {track.name}</span>
            <h1>{lesson.title}</h1>
            <div className="lrn-lmeta">
              <span className="lrn-mins"><ClockIcon aria-hidden="true" />{lesson.minutes} min read</span>
              {lesson.reviewed ? <span>Last reviewed {monthOf(lesson.reviewed)}</span> : null}
              <span className="lrn-dots" role="img" aria-label={`Lesson ${index + 1} of ${track.lessons.length} in ${track.name}`}>
                {track.lessons.map((s, i) => <i key={s} className={i === index ? "cur" : read[s] ? "on" : undefined} />)}
              </span>
              {done ? <span className="lrn-read"><CheckIcon aria-hidden="true" />Read</span> : null}
            </div>
          </header>
          <div className="lrn-prose">
            {lesson.lede ? <p className="lrn-lede" dangerouslySetInnerHTML={{ __html: lesson.lede }} /> : null}
            {lesson.segments.map((s, i) => <Piece key={i} s={s} lesson={lesson} mode={mode} from={here} />)}
          </div>
          <div className="lrn-endrow">
            {done
              ? <Button variant="outline" onClick={() => { kept.current = true; markUnread(lesson.slug); }}><RotateCcwIcon aria-hidden="true" />Mark as unread</Button>
              : <Button variant="outline" onClick={() => markRead(lesson.slug)}><CheckIcon aria-hidden="true" />Mark as read</Button>}
            {next ? <>
              <span className="lrn-cap">Next: <b>{next.title}</b></span>
              <Button nativeButton={false} render={<Link href={lessonHref(mode, next.slug)} />}>Next lesson<ArrowRightIcon aria-hidden="true" /></Button>
            </> : <Button nativeButton={false} render={<Link href={learnHome(mode)} />}>Back to Learn<ArrowRightIcon aria-hidden="true" /></Button>}
          </div>
          <p className="lrn-disclaim">Lessons explain how things work. They aren&rsquo;t personal financial, tax or legal advice.</p>
        </article>

        <div className="lrn-aside">
          {lesson.yours ? <YoursPanel k={lesson.yours} /> : null}
          {lesson.tool ? (
            <Card size="sm">
              <CardHeader><CardTitle><CalculatorIcon aria-hidden="true" />Try it</CardTitle></CardHeader>
              <CardContent><div className="lrn-try">
                {/* The public tools fill in from Your household, not the plan; only the Dashboard's copies take the plan. */}
                <p>{mode === "dashboard" ? lesson.tryText : lesson.tryText.replace(/, with your plan already filled in\./, ".")}</p>
                <Button nativeButton={false} render={<Link href={tryHref} />}>Open the tool<ArrowRightIcon aria-hidden="true" /></Button>
              </div></CardContent>
            </Card>
          ) : null}
          {lesson.terms.length ? (
            <Card size="sm">
              <CardHeader><CardTitle><BookOpenIcon aria-hidden="true" />Key terms</CardTitle></CardHeader>
              <CardContent><dl className="lrn-terms">{lesson.terms.map((t) => <div key={t.term}><dt>{t.term}</dt><dd>{t.def}</dd></div>)}</dl></CardContent>
            </Card>
          ) : null}
          {lesson.deeper.length ? (
            <Card size="sm">
              <CardHeader><CardTitle><ExternalLinkIcon aria-hidden="true" />Go deeper</CardTitle></CardHeader>
              <CardContent><ul className="lrn-deeper">{lesson.deeper.map((d) => (
                <li key={d.href}><a href={d.href} target="_blank" rel="noopener noreferrer"><span>{d.title}<small>{d.source}</small></span><ExternalLinkIcon aria-hidden="true" /></a></li>
              ))}</ul></CardContent>
            </Card>
          ) : null}
          {lesson.toc.length > 2 ? <Contents toc={lesson.toc} /> : null}
        </div>
      </div>
    </div>
  );
}
