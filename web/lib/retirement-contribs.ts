/* What each retirement calculator (Basic, Advanced, Stages) has you
   contributing, as a monthly figure: the Budget's "+ Retirement
   contribution" offers each one that has one. Until those calculators are
   ported (phase 4) they haven't been opened here, so their defaults stand
   in, the same defaults the old site started them with. The keys below are
   the ones their ported inputs must keep. */
import { toolInputs } from "@/components/tools/ToolState";
import { PPY } from "@/lib/engine";
import { parseNum } from "@/lib/format";

const perYear = PPY as Record<string, number>;
type Contrib = { contrib: string; period: string };

export function retirementContribs(): { label: string; value: number }[] {
  const basic = toolInputs<Contrib>("basic", { contrib: "500", period: "Monthly" });
  const advanced = toolInputs<Contrib>("advanced", { contrib: "500", period: "Bi-Weekly" });
  const stages = toolInputs<{ stages: Contrib[] }>("stages", { stages: [{ contrib: "500", period: "Bi-Weekly" }] });
  const first = stages.stages[0] ?? { contrib: "0", period: "Monthly" };
  return [
    { label: "Basic", ...basic },
    { label: "Advanced", ...advanced },
    { label: "Stages", ...first },
  ]
    .map((c) => ({ label: c.label, value: (parseNum(c.contrib) * (perYear[c.period] ?? 12)) / 12 }))
    .filter((c) => c.value > 0);
}
