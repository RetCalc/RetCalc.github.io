"use client";

/* A lesson, laid out as the approved mock C: the text on the left, and
   beside it Your numbers, Try it, Key terms, Go deeper and "In this lesson"
   (which stays in view while reading and marks the section you're in).
   Narrower than 1180px there's no room beside the text, so the aids come
   into the reading column where they're needed: a Contents control at the
   top, Your numbers after the lede, Try it and Key terms before the end.
   The lesson counts as read once its "In short" comes into view. */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowRightIcon, CalculatorIcon, CheckIcon, ChevronDownIcon, ChevronLeftIcon, ClockIcon, ExternalLinkIcon, ListIcon, BookOpenIcon, RotateCcwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { Lesson, LessonSummary, Segment } from "@/lib/learn/lessons";
import type { Track } from "@/lib/learn/catalog";
import { Chart } from "./Chart";
import { Widget } from "./widgets";
import { YoursLine, YoursPanel } from "./Yours";
import { useLearn } from "./progress";
import { hrefIn, learnHome, lessonHref, rewriteLinks, type LearnMode } from "./links";
import { markNumberColumns } from "./tables";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthOf = (iso: string) => { const [y, m] = iso.split("-"); return `${MONTHS[+m - 1]} ${y}`; };

/** Inside the Dashboard its title bar holds the page's h1, so the lesson's
    headings each step down one level (styled as before: .lrn-sub). */
const stepDown = (html: string) => html.replace(/<(\/?)h([2-5])\b/g, (_, s: string, n: string) => `<${s}h${+n + 1}`);

function Piece({ s, lesson, mode, from }: { s: Segment; lesson: Lesson; mode: LearnMode; from: string }) {
  if (s.kind === "html") {
    const html = markNumberColumns(rewriteLinks(mode, s.html, from));
    return <div dangerouslySetInnerHTML={{ __html: mode === "dashboard" ? stepDown(html) : html }} />;
  }
  if (s.kind === "chart") return <figure className="lrn-figure"><Chart spec={s.spec} label={s.caption.replace(/<[^>]+>/g, "")} />{s.caption ? <figcaption dangerouslySetInnerHTML={{ __html: s.caption }} /> : null}</figure>;
  if (s.kind === "widget") return <figure className="lrn-figure"><Widget name={s.name} label={s.caption.replace(/<[^>]+>/g, "")} />{s.caption ? <figcaption dangerouslySetInnerHTML={{ __html: s.caption }} /> : null}</figure>;
  return lesson.yours ? <YoursLine k={lesson.yours} /> : null;
}

/** The section on screen: the last heading above the upper part of the
    screen, and the last section once its heading is in the upper half (the
    end of a lesson is often too short to reach the top). */
function useSection(toc: Lesson["toc"]) {
  const [on, setOn] = useState(toc[0]?.id ?? "");
  useEffect(() => {
    let frame = 0;
    const mark = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        let cur = toc[0]?.id ?? "";
        for (const t of toc) { const h = document.getElementById(t.id); if (h && h.getBoundingClientRect().top < 140) cur = t.id; }
        const last = toc[toc.length - 1], lh = last && document.getElementById(last.id);
        if (lh && lh.getBoundingClientRect().top < innerHeight / 2) cur = last.id;
        setOn(cur);
      });
    };
    mark();
    addEventListener("scroll", mark, { passive: true });
    return () => { removeEventListener("scroll", mark); cancelAnimationFrame(frame); };
  }, [toc]);
  return on;
}

function TocList({ toc, on, onJump }: { toc: Lesson["toc"]; on: string; onJump: (id: string) => void }) {
  return (
    <ol>
      {toc.map((t) => (
        <li key={t.id}><a href={`#${t.id}`} aria-current={t.id === on ? "true" : undefined}
          onClick={(e) => { e.preventDefault(); onJump(t.id); document.getElementById(t.id)?.scrollIntoView({ behavior: "smooth" }); history.replaceState(null, "", `#${t.id}`); }}>{t.text}</a></li>
      ))}
    </ol>
  );
}

/** "In this lesson" beside the text. */
function Contents({ toc, on, onJump }: { toc: Lesson["toc"]; on: string; onJump: (id: string) => void }) {
  return (
    <div className="lrn-toc lrn-wide"><Card size="sm">
      <CardHeader><CardTitle><ListIcon aria-hidden="true" />In this lesson</CardTitle></CardHeader>
      <CardContent><nav aria-label="In this lesson"><TocList toc={toc} on={on} onJump={onJump} /></nav></CardContent>
    </Card></div>
  );
}

/** Narrower screens: the same list, folded into one line that stays at the
    top of the screen and names the section you're in. */
function ContentsBar({ toc, on, onJump }: { toc: Lesson["toc"]; on: string; onJump: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const cur = toc.find((t) => t.id === on) ?? toc[0];
  return (
    <div className="lrn-mtoc lrn-narrow"><Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger variant="row">
        <span className="lrn-mtoc-l"><ListIcon aria-hidden="true" /><span>Contents</span><span className="lrn-mtoc-cur">{cur?.text}</span></span>
        <ChevronDownIcon aria-hidden="true" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <nav aria-label="In this lesson"><TocList toc={toc} on={on} onJump={(id) => { setOpen(false); onJump(id); }} /></nav>
      </CollapsibleContent>
    </Collapsible></div>
  );
}

export function LessonPage({ lesson, next, track, mode }: { lesson: Lesson; next: LessonSummary | null; track: Track; mode: LearnMode }) {
  const router = useRouter();
  const { read, markRead, markUnread } = useLearn();
  const done = !!read[lesson.slug];
  const here = lessonHref(mode, lesson.slug);
  const dash = mode === "dashboard";
  const H = dash ? "h2" : "h1";
  // Unmarked by hand: don't mark it again on this visit.
  const kept = useRef(false);
  // A jump to "In short" from the contents isn't reading it: wait for the
  // reader's own scrolling (wheel, touch or keys) before it counts.
  const jumped = useRef(false);
  const [said, setSaid] = useState("");
  const article = useRef<HTMLElement>(null);
  const on = useSection(lesson.toc);
  const onJump = (id: string) => { if (id === "short") jumped.current = true; };

  useEffect(() => {
    const end = document.getElementById("short");
    if (!end) return;
    let frame = 0;
    // In view, or already above it (a fast jump or the End key skips past).
    const check = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (kept.current || jumped.current || read[lesson.slug]) return;
        if (end.getBoundingClientRect().top < innerHeight * 0.8) { markRead(lesson.slug); setSaid("Marked as read."); }
      });
    };
    const mine = () => { jumped.current = false; check(); };
    check();
    addEventListener("scroll", check, { passive: true });
    addEventListener("wheel", mine, { passive: true });
    addEventListener("touchmove", mine, { passive: true });
    addEventListener("keydown", mine);
    return () => {
      cancelAnimationFrame(frame);
      removeEventListener("scroll", check); removeEventListener("wheel", mine); removeEventListener("touchmove", mine); removeEventListener("keydown", mine);
    };
  }, [lesson.slug, markRead, read]);

  const tryHref = hrefIn(mode, "/" + lesson.tool, here);
  const index = track.lessons.indexOf(lesson.slug);
  const contents = lesson.toc.length > 2;

  const tryCard = lesson.tool ? (
    <Card size="sm">
      <CardHeader><CardTitle><CalculatorIcon aria-hidden="true" />Try it</CardTitle></CardHeader>
      <CardContent><div className="lrn-try">
        {/* The public tools fill in from Your household, not the plan; only the Dashboard's copies take the plan. */}
        <p>{dash ? lesson.tryText : lesson.tryText.replace(/, with your plan already filled in\./, ".")}</p>
        <Button nativeButton={false} render={<Link href={tryHref} />}>Open the tool<ArrowRightIcon aria-hidden="true" /></Button>
      </div></CardContent>
    </Card>
  ) : null;
  const termsCard = lesson.terms.length ? (
    <Card size="sm">
      <CardHeader><CardTitle><BookOpenIcon aria-hidden="true" />Key terms</CardTitle></CardHeader>
      <CardContent><dl className="lrn-terms">{lesson.terms.map((t) => <div key={t.term}><dt>{t.term}</dt><dd>{t.def}</dd></div>)}</dl></CardContent>
    </Card>
  ) : null;

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
            <H className="lrn-title">{lesson.title}</H>
            <div className="lrn-lmeta">
              <span className="lrn-mins"><ClockIcon aria-hidden="true" />{lesson.minutes} min read</span>
              {lesson.reviewed ? <span>Last reviewed {monthOf(lesson.reviewed)}</span> : null}
              <span className="lrn-dots" role="img" aria-label={`Lesson ${index + 1} of ${track.lessons.length} in ${track.name}`}>
                {track.lessons.map((s, i) => <i key={s} className={i === index ? "cur" : read[s] ? "on" : undefined} />)}
              </span>
              {done ? <span className="lrn-read"><CheckIcon aria-hidden="true" />Read</span> : null}
            </div>
          </header>
          {contents ? <ContentsBar toc={lesson.toc} on={on} onJump={onJump} /> : null}
          <div className={`lrn-prose${dash ? " lrn-sub" : ""}`}>
            {lesson.lede ? <p className="lrn-lede" dangerouslySetInnerHTML={{ __html: lesson.lede }} /> : null}
            {lesson.yours ? <div className="lrn-narrow lrn-yours-in"><YoursPanel k={lesson.yours} /></div> : null}
            {lesson.segments.map((s, i) => <Piece key={i} s={s} lesson={lesson} mode={mode} from={here} />)}
          </div>
          {tryCard || termsCard ? <div className="lrn-narrow lrn-endaids">{tryCard}{termsCard}</div> : null}
          <div className="lrn-endrow">
            {done
              ? <Button variant="outline" onClick={() => { kept.current = true; markUnread(lesson.slug); setSaid("Marked as unread."); }}><RotateCcwIcon aria-hidden="true" />Mark as unread</Button>
              : <Button variant="outline" onClick={() => { markRead(lesson.slug); setSaid("Marked as read."); }}><CheckIcon aria-hidden="true" />Mark as read</Button>}
            {next ? <>
              <span className="lrn-cap">Next: <b>{next.title}</b></span>
              <Button nativeButton={false} render={<Link href={lessonHref(mode, next.slug)} />}>Next lesson<ArrowRightIcon aria-hidden="true" /></Button>
            </> : <Button nativeButton={false} render={<Link href={learnHome(mode)} />}>Back to Learn<ArrowRightIcon aria-hidden="true" /></Button>}
          </div>
          <p className="sr-only" role="status" aria-live="polite">{said}</p>
          <p className="lrn-disclaim">Lessons explain how things work. They aren&rsquo;t personal financial, tax or legal advice.</p>
        </article>

        <div className="lrn-aside">
          {lesson.yours ? <div className="lrn-wide"><YoursPanel k={lesson.yours} /></div> : null}
          {tryCard ? <div className="lrn-wide">{tryCard}</div> : null}
          {termsCard ? <div className="lrn-wide">{termsCard}</div> : null}
          {lesson.deeper.length ? (
            <Card size="sm">
              <CardHeader><CardTitle><ExternalLinkIcon aria-hidden="true" />Go deeper</CardTitle></CardHeader>
              <CardContent><ul className="lrn-deeper">{lesson.deeper.map((d) => (
                <li key={d.href}><a href={d.href} target="_blank" rel="noopener noreferrer"><span>{d.title}<small>{d.source}</small></span><ExternalLinkIcon aria-hidden="true" /></a></li>
              ))}</ul></CardContent>
            </Card>
          ) : null}
          {contents ? <Contents toc={lesson.toc} on={on} onJump={onJump} /> : null}
        </div>
      </div>
    </div>
  );
}
