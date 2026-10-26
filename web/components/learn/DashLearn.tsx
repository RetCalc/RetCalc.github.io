"use client";

/* Learn inside the Dashboard: its frame and rail around the same pages,
   with links that stay in the Dashboard (components/learn/links.ts). */

import { useState } from "react";
import { Frame, SignedIn } from "@/components/dashboard/Frame";
import type { Track } from "@/lib/learn/catalog";
import type { Lesson, LessonSummary, Segment } from "@/lib/learn/lessons";
import { LearnHome, LearnSearch } from "./LearnHome";
import { LessonPage } from "./LessonPage";

export function DashLearnHome({ lessons, previews }: { lessons: LessonSummary[]; previews: Record<string, Segment> }) {
  const [q, setQ] = useState("");
  return (
    <SignedIn>
      <Frame current="learn" title="Learn" sub="Lessons on the ideas behind your plan" actions={<LearnSearch value={q} onChange={setQ} />}>
        <LearnHome lessons={lessons} previews={previews} mode="dashboard" search={q} />
      </Frame>
    </SignedIn>
  );
}

export function DashLesson({ lesson, next, track }: { lesson: Lesson; next: LessonSummary | null; track: Track }) {
  return (
    <SignedIn>
      <Frame current="learn" title="Learn">
        <LessonPage lesson={lesson} next={next} track={track} mode="dashboard" />
      </Frame>
    </SignedIn>
  );
}
