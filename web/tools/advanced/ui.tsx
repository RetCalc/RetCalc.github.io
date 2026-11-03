/* Pieces both of the Advanced calculator's screens draw (Advanced.tsx on
   the site, PlanScreen.tsx on the Dashboard). */

import { cn } from "@/lib/utils";

/** A heading over one group of the inputs, on a rule after the first. */
export function GroupHead({ first, children }: { first?: boolean; children: React.ReactNode }) {
  return <h3 className={cn("m-0 mb-3 text-sm font-semibold", !first && "mt-1 border-t border-border pt-4")}>{children}</h3>;
}
