"use client";

/* Learn: plain explanations of how the plan works and what to do about it.
   A place held for now; the reading comes later. */

import { GraduationCapIcon } from "lucide-react";
import { Frame } from "./Frame";

export function Learn() {
  return (
    <Frame current="learn" title="Learn">
      <div className="dsh-center">
        <div className="dsh-card">
          <GraduationCapIcon aria-hidden="true" />
          <h1>Learning, coming soon</h1>
          <p>Short, plain explanations of the ideas behind your plan will live here.</p>
        </div>
      </div>
    </Frame>
  );
}
