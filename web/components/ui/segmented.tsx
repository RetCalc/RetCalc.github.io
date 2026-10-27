"use client"

import * as React from "react"
import { Toggle as TogglePrimitive } from "@base-ui/react/toggle"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

/* The segmented switch: a row of shadcn Toggles in a ground track with a
   strong edge. Each option is its own Tab stop, chosen with Enter or Space,
   as before. ToggleGroup isn't used because its roving focus (one Tab stop,
   arrow keys between options) would change how the switch is used from the
   keyboard.

   The chosen option is a filled, rounded pill inset in the track, drawn
   by the option itself, so every switch shows it the same way: on a page,
   in a dialog, on the main site or the dashboard, light or dark. The group
   keeps the class `seg` and each chosen option the class `on`: the Guide's
   trips, the coach panel and the tool readers look for `.on`. The size is
   set once on the group; the options follow it. */
const segmentedVariants = cva(
  "seg group/seg relative inline-flex flex-none gap-0.5 overflow-hidden border border-input bg-background p-0.75",
  {
    variants: {
      size: {
        default: "rounded-(--r-well)",
        /* Drawdown's three views: larger, and full width on a phone. */
        tab: "rounded-(--r-well) max-sm:flex max-sm:w-full",
        /* Budget's /yr and /mo: small, in figures, and quiet (twenty of them
           sit in one list): a slimmer track, the chosen option also at
           medium weight. */
        compact: "rounded-md p-0.5",
        /* The Optimizer's two goals: full width, options shared equally. */
        fill: "flex w-full rounded-(--r-well)",
        /* A chart's mode switch: as default on wider screens; on a phone
           full width, the options sharing it equally at a thumb's height. */
        chart: "rounded-(--r-well) max-sm:flex max-sm:w-full",
      },
    },
    defaultVariants: { size: "default" },
  }
)

function Segmented({
  className,
  size = "default",
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof segmentedVariants>) {
  return (
    <span
      data-slot="segmented"
      data-size={size}
      className={cn(segmentedVariants({ size }), className)}
      {...props}
    />
  )
}

function SegmentedItem({
  className,
  pressed,
  ...props
}: TogglePrimitive.Props) {
  return (
    <TogglePrimitive
      data-slot="segmented-item"
      pressed={pressed}
      className={cn(
        "relative z-1 inline-flex min-h-7 cursor-pointer items-center justify-center rounded-[calc(var(--r-well)-4px)] bg-transparent px-2.75 py-1.25 text-xs whitespace-nowrap text-muted-foreground transition-colors outline-none pointer-coarse:min-h-9 pointer-coarse:px-3.5 pointer-coarse:py-2 pointer-coarse:text-sm pointer-coarse:select-none hover:text-foreground hover:not-data-pressed:bg-foreground/5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring disabled:cursor-default disabled:opacity-40",
        // The chosen option: filled a shade darker (lighter in dark mode), with a fine edge.
        "data-pressed:bg-foreground/10 data-pressed:text-foreground data-pressed:shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--foreground)_16%,transparent)]",
        "group-data-[size=tab]/seg:px-4 group-data-[size=tab]/seg:py-1.25 group-data-[size=tab]/seg:text-[13px] max-sm:group-data-[size=tab]/seg:flex-1 max-sm:group-data-[size=tab]/seg:px-1.5 max-sm:group-data-[size=tab]/seg:py-1.75",
        "group-data-[size=compact]/seg:rounded-[calc(var(--radius-md)-3px)] group-data-[size=compact]/seg:min-h-7.5 group-data-[size=compact]/seg:px-2.25 group-data-[size=compact]/seg:py-1 group-data-[size=compact]/seg:font-mono group-data-[size=compact]/seg:text-[11px] group-data-[size=compact]/seg:leading-none pointer-coarse:group-data-[size=compact]/seg:min-h-10 pointer-coarse:group-data-[size=compact]/seg:px-3 pointer-coarse:group-data-[size=compact]/seg:py-2 pointer-coarse:group-data-[size=compact]/seg:text-sm group-data-[size=compact]/seg:data-pressed:font-medium",
        "max-sm:group-data-[size=chart]/seg:min-h-9.5 max-sm:group-data-[size=chart]/seg:flex-1",
        "group-data-[size=fill]/seg:flex-1 group-data-[size=fill]/seg:px-2.5 group-data-[size=fill]/seg:py-1 group-data-[size=fill]/seg:text-[12.5px]",
        pressed && "on",
        className
      )}
      {...props}
    />
  )
}

export { Segmented, SegmentedItem, segmentedVariants }
