/* What each retirement calculator (Basic, Advanced, Stages) has you
   contributing, as a monthly figure: the Budget's "+ Retirement
   contribution" offers each one that has one. Until those calculators are
   opened here, their defaults stand in, the same defaults the old site
   started them with. */
import { toolInputs } from "@/components/tools/ToolState";
import { PER_YEAR } from "@/lib/engine/typed";
import { parseNum } from "@/lib/format";
import { ADVANCED_DEFAULTS } from "@/tools/advanced/model";
import { BASIC_INPUTS } from "@/tools/basic/model";
import { STAGES_DEFAULTS } from "@/tools/stages/model";

type Contrib = { contrib: string; period: string };

export function retirementContribs(): { label: string; value: number }[] {
  const basic = toolInputs<Contrib>("basic", BASIC_INPUTS);
  const advanced = toolInputs<Contrib>("advanced", ADVANCED_DEFAULTS);
  const stages = toolInputs<{ stages: Contrib[] }>("stages", STAGES_DEFAULTS);
  const first = stages.stages[0] ?? { contrib: "0", period: "Monthly" };
  return [
    { label: "Basic", ...basic },
    { label: "Advanced", ...advanced },
    { label: "Stages", ...first },
  ]
    .map((c) => ({ label: c.label, value: (parseNum(c.contrib) * (PER_YEAR[c.period] ?? 12)) / 12 }))
    .filter((c) => c.value > 0);
}
