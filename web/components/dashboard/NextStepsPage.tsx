"use client";

/* Next steps: every step that fills in or sharpens the plan, the ones still
   to do first, in the order they matter most. */

import Link from "next/link";
import { useMemo } from "react";
import { CheckIcon, ListChecksIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Frame } from "./Frame";
import { results } from "./model";
import { allSteps } from "./nextsteps";
import { useDashboard } from "./store";
import { Tile } from "./ui";

export function NextSteps() {
  const { data } = useDashboard();
  const R = useMemo(() => results(data.profile, data.entries), [data.profile, data.entries]);
  const steps = allSteps(data, R), todo = steps.filter((s) => !s.done), done = steps.filter((s) => s.done);
  return (
    <Frame current="next" title="Next steps" sub={`${todo.length} to do, ${done.length} done`}>
      <Tile icon={ListChecksIcon} title="To do" right={<span className="dsh-cap">Ordered by how much each moves your plan</span>}>
        <ol className="dsh-steps">
          {todo.map((s, i) => (
            <li key={s.id} className="dsh-step"><span className="dsh-num">{i + 1}</span><div><b>{s.title}</b><span>{s.why}</span></div><Button variant="outline" size="sm" nativeButton={false} render={<Link href={s.href} />}>{s.action}</Button></li>
          ))}
          {!todo.length ? <li className="dsh-cap">Nothing left. Come back each month or so to update your balances.</li> : null}
        </ol>
      </Tile>
      {done.length ? (
        <div className="dsh-r4"><Tile icon={CheckIcon} title="Done">
          <ol className="dsh-steps">
            {done.map((s) => (
              <li key={s.id} className="dsh-step dsh-done"><span className="dsh-num"><CheckIcon aria-hidden="true" /></span><div><b>{s.title}</b><span>{s.why}</span></div><Button variant="link" size="inline" nativeButton={false} render={<Link href={s.href} />}>Open</Button></li>
            ))}
          </ol>
        </Tile></div>
      ) : null}
    </Frame>
  );
}
