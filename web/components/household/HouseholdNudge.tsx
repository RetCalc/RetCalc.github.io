"use client";

/* Under a tool's header: the household has numbers this tool isn't using
   (the Guide, or the household dialog, saved them after the tool last
   filled in). It offers them rather than filling them in behind your back,
   and stays out of the way once you've said no for that household. */

import { useEffect, useState } from "react";
import { XIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { householdSummary, isEmptyHousehold } from "@/lib/household";
import { STATE_OPTIONS } from "@/lib/states";
import { useHousehold } from "./HouseholdProvider";

const DISMISSED = "retcalc-household-nudge";
const stateName = (c: string) => STATE_OPTIONS.find((s) => s.code === c)?.name;

export function HouseholdNudge() {
  const { profile, link } = useHousehold();
  const key = link && profile ? link.tool + ":" + JSON.stringify({ ...profile, savedAt: 0 }) : null;
  const [dismissed, setDismissed] = useState<string | null>(null);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- storage exists only after the page has loaded
      setDismissed(sessionStorage.getItem(DISMISSED));
    } catch { /* storage blocked: the note shows */ }
  }, []);
  if (!link || !profile || !key || isEmptyHousehold(profile) || !link.takes || link.matches || dismissed === key) return null;
  const sum = householdSummary(profile, stateName).short.slice(0, 3).join(" · ");
  const dismiss = () => {
    setDismissed(key);
    try { sessionStorage.setItem(DISMISSED, key); } catch { /* storage blocked */ }
  };
  return (
    <Alert role="status" className="col-span-full mb-1" id="hhNudge">
      <AlertDescription>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="min-w-0 flex-1 basis-60">Your household ({sum}) has numbers this tool isn&apos;t using.</span>
          <span className="flex items-center gap-1">
            <Button size="sm" variant="secondary" onClick={() => { link.apply(); dismiss(); }}>Use them</Button>
            <Button size="icon-sm" variant="ghost" aria-label="Keep this tool's numbers" title="Keep this tool's numbers" onClick={dismiss}><XIcon aria-hidden="true" /></Button>
          </span>
        </div>
      </AlertDescription>
    </Alert>
  );
}
