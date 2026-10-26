"use client";

/* The Learn home, as the approved mock C (mock B's home): the lesson that
   matters most for the reader next, with its picture; then the tracks on
   the left and the chosen track as a numbered route, each lesson with what
   it covers, its tool, its length and whether it's been read. A search
   across every lesson replaces the route while it has words in it. */

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRightIcon, CheckIcon, ClockIcon, SearchIcon, SparklesIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { TRACKS, type TrackId } from "@/lib/learn/catalog";
import type { LessonSummary, Preview as PreviewData } from "@/lib/learn/lessons";
import { Chart } from "./Chart";
import { Widget } from "./widgets";
import { useLearn } from "./progress";
import { useSuggestions } from "./suggest";
import { lessonHref, type LearnMode } from "./links";
import { TOOL_NAMES } from "./tool-names";

function Ring({ share }: { share: number }) {
  return <span className="lrn-ring" style={{ "--p": Math.round(share * 100) } as React.CSSProperties} aria-hidden="true" />;
}

function Preview({ seg }: { seg: PreviewData | undefined }) {
  if (!seg) return null;
  if (seg.kind === "toc") return (
    <div className="lrn-prev lrn-prev-toc">
      <span className="lrn-eyebrow">In this lesson</span>
      <ol>{seg.items.map((t) => <li key={t}>{t}</li>)}</ol>
    </div>
  );
  if (seg.kind === "chart") return <div className="lrn-prev"><Chart spec={seg.spec} label={seg.caption.replace(/<[^>]+>/g, "")} /></div>;
  if (seg.kind === "widget") return <div className="lrn-prev"><Widget name={seg.name} label={seg.caption.replace(/<[^>]+>/g, "")} /></div>;
  return null;
}

export function LearnSearch({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="lrn-search"><InputGroup>
      <InputGroupAddon><SearchIcon aria-hidden="true" /></InputGroupAddon>
      <InputGroupInput type="search" placeholder="Search lessons" aria-label="Search lessons" value={value} onChange={(e) => onChange(e.target.value)} />
      {value ? <InputGroupAddon align="inline-end"><InputGroupButton size="icon-xs" aria-label="Clear the search" onClick={() => onChange("")}><XIcon aria-hidden="true" /></InputGroupButton></InputGroupAddon> : null}
    </InputGroup></div>
  );
}

function Stop({ l, n, status, mode }: { l: LessonSummary; n: number; status: "read" | "next" | "for" | null; mode: LearnMode }) {
  return (
    <li className={`lrn-stop${status === "read" ? " dn" : ""}${status === "next" ? " nx" : ""}`}>
      <Link href={lessonHref(mode, l.slug)}>
        <span className="lrn-node" aria-hidden="true">{status === "read" ? <CheckIcon /> : n}</span>
        <span className="lrn-txt"><b>{l.title}</b><span>{l.idea}</span></span>
        <span className="lrn-meta">
          {TOOL_NAMES[l.tool] ? <span className="lrn-tool">{TOOL_NAMES[l.tool]}</span> : null}
          <span className="lrn-mins"><ClockIcon aria-hidden="true" />{l.minutes} min</span>
          <span className={`lrn-stat ${status ?? ""}`}>{status === "read" ? "Read" : status === "for" ? "For you" : status === "next" ? "Up next" : ""}</span>
        </span>
      </Link>
    </li>
  );
}

export function LearnHome({ lessons, previews, mode, search: outerSearch }: { lessons: LessonSummary[]; previews: Record<string, PreviewData>; mode: LearnMode; search?: string }) {
  const { read } = useLearn();
  const picks = useSuggestions(lessons, read);
  const pick = picks[0], top = pick ? lessons.find((l) => l.slug === pick.slug) : undefined;
  const [cur, setCur] = useState<TrackId>(() => (top?.track as TrackId) || "foundations");
  const [q, setQ] = useState("");
  const query = (outerSearch ?? q).trim().toLowerCase();
  const by = useMemo(() => new Map(lessons.map((l) => [l.slug, l])), [lessons]);
  const track = TRACKS.find((t) => t.id === cur) ?? TRACKS[0];
  const tl = track.lessons.map((s) => by.get(s)).filter((l): l is LessonSummary => !!l);
  const nextI = tl.findIndex((l) => !read[l.slug]);
  const forYou = new Set(picks.slice(0, 3).map((p) => p.slug));
  const nextTrack = TRACKS[(TRACKS.indexOf(track) + 1) % TRACKS.length];
  const found = query ? lessons.filter((l) => (l.title + " " + l.idea + " " + l.points.join(" ")).toLowerCase().includes(query)) : [];
  const readCount = (id: TrackId) => (TRACKS.find((t) => t.id === id)?.lessons ?? []).filter((s) => read[s]).length;
  const total = lessons.length, done = lessons.filter((l) => read[l.slug]).length;

  return (
    <div className="lrn">
      {outerSearch == null ? <div className="lrn-homebar"><p className="lrn-cap">{total} lessons in {TRACKS.length} tracks{done ? `, ${done} read` : ""}. Start anywhere: each lesson stands on its own.</p><LearnSearch value={q} onChange={setQ} /></div> : null}
      {top && pick ? (
        <Card size="flush"><div className="lrn-next4u">
          <div>
            <span className="lrn-eyebrow lrn-amber"><SparklesIcon aria-hidden="true" />Next for you</span>
            <h2>{top.title}</h2>
            <p className="lrn-why">{pick.why}</p>
            {top.points.length ? <ul>{top.points.map((p) => <li key={p}>{p}</li>)}</ul> : null}
            <div className="lrn-acts">
              <Button size="lg" nativeButton={false} render={<Link href={lessonHref(mode, top.slug)} />}>Start the lesson<ArrowRightIcon aria-hidden="true" /></Button>
              <span className="lrn-mins"><ClockIcon aria-hidden="true" />{top.minutes} min read</span>
              {picks.length > 1 ? <span className="lrn-also">Also for you: {picks.slice(1, 3).map((p, i) => <span key={p.slug}>{i ? " · " : ""}<Link href={lessonHref(mode, p.slug)}>{by.get(p.slug)?.title}</Link></span>)}</span> : null}
            </div>
          </div>
          <Preview seg={previews[top.slug]} />
        </div></Card>
      ) : null}

      <div className="lrn-body2">
        <nav className="lrn-tlist" aria-label="Tracks">
          <Card size="sm">
            {TRACKS.map((t) => {
              const n = t.lessons.filter((s) => by.has(s)).length;
              return (
                <button key={t.id} type="button" className="lrn-tbtn" aria-pressed={t.id === cur} onClick={() => { setCur(t.id); setQ(""); }}>
                  <Ring share={n ? readCount(t.id) / n : 0} />
                  <span><b>{t.name}</b><span>{readCount(t.id)} of {n} read</span></span>
                </button>
              );
            })}
          </Card>
        </nav>
        {query ? (
          <Card size="flush">
            <div className="lrn-path-h"><div><span className="lrn-eyebrow">Search</span><h2>{found.length ? `${found.length} ${found.length === 1 ? "lesson" : "lessons"} found` : "No lessons found"}</h2><p>for &ldquo;{outerSearch ?? q}&rdquo;</p></div></div>
            <ol className="lrn-route">{found.map((l, i) => <Stop key={l.slug} l={l} n={i + 1} status={read[l.slug] ? "read" : null} mode={mode} />)}</ol>
          </Card>
        ) : (
          <Card size="flush">
            <div className="lrn-path-h">
              <div><span className="lrn-eyebrow">Track {TRACKS.indexOf(track) + 1} of {TRACKS.length}</span><h2>{track.name}</h2><p>{track.blurb}</p></div>
              <div className="lrn-path-r"><div className="lrn-fig">{readCount(track.id)}<small>of {tl.length}</small></div><span className="lrn-cap">lessons read</span></div>
            </div>
            <ol className="lrn-route">
              {tl.map((l, i) => <Stop key={l.slug} l={l} n={i + 1} mode={mode} status={read[l.slug] ? "read" : forYou.has(l.slug) ? "for" : i === nextI ? "next" : null} />)}
            </ol>
            <div className="lrn-after">
              <span>After this track: <b>{nextTrack.name}</b>, {nextTrack.lessons.filter((s) => by.has(s)).length} lessons</span>
              <Button variant="outline" size="sm" onClick={() => { setCur(nextTrack.id); scrollTo({ top: 0, behavior: "smooth" }); }}>Go to track<ArrowRightIcon aria-hidden="true" /></Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
