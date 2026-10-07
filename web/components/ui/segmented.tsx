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

   The group keeps the class `seg` and each chosen option the class `on`:
   PageEffects slides a raised thumb (.seg-thumb) under `.seg button.on`,
   and the Guide's trips, the coach panel and the tool readers look for
   `.on` too. The size is set once on the group; the options follow it. */
const segmentedVariants = cva(
  "seg group/seg relative inline-flex flex-none overflow-hidden border border-input bg-background [&>button+button]:border-l [&>button+button]:border-border [&>button.on]:border-l-transparent [&>button.on+button]:border-l-transparent",
  {
    variants: {
      size: {
        default: "rounded-(--r-well)",
        /* Drawdown's three views: larger, and full width on a phone. */
        tab: "rounded-(--r-well) max-sm:flex max-sm:w-full",
        /* Budget's /yr and /mo: small, in figures, and quiet (twenty of them
           sit in one list): the chosen option is Text at medium weight on
           the thumb, with no fill or weight of its own. */
        compact: "rounded-md",
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
        "relative z-1 inline-flex min-h-8.5 cursor-pointer items-center justify-center bg-transparent px-2.75 py-1.5 text-xs whitespace-nowrap text-muted-foreground transition-colors outline-none pointer-coarse:min-h-10.5 pointer-coarse:px-3.5 pointer-coarse:py-2.5 pointer-coarse:text-sm pointer-coarse:select-none hover:text-foreground hover:not-data-pressed:bg-foreground/5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring disabled:cursor-default disabled:opacity-40 data-pressed:text-foreground",
        "group-data-[size=tab]/seg:px-4 group-data-[size=tab]/seg:py-2 group-data-[size=tab]/seg:text-[13px] max-sm:group-data-[size=tab]/seg:flex-1 max-sm:group-data-[size=tab]/seg:px-1.5 max-sm:group-data-[size=tab]/seg:py-2.5",
        "group-data-[size=compact]/seg:px-2.25 group-data-[size=compact]/seg:py-1.25 group-data-[size=compact]/seg:font-mono group-data-[size=compact]/seg:text-[11px] group-data-[size=compact]/seg:leading-none pointer-coarse:group-data-[size=compact]/seg:min-h-11 pointer-coarse:group-data-[size=compact]/seg:px-3 pointer-coarse:group-data-[size=compact]/seg:py-2.25 pointer-coarse:group-data-[size=compact]/seg:text-sm group-data-[size=compact]/seg:data-pressed:font-medium",
        "max-sm:group-data-[size=chart]/seg:min-h-11 max-sm:group-data-[size=chart]/seg:flex-1",
        "group-data-[size=fill]/seg:flex-1 group-data-[size=fill]/seg:px-2.5 group-data-[size=fill]/seg:py-1.75 group-data-[size=fill]/seg:text-[12.5px]",
        pressed && "on",
        className
      )}
      {...props}
    />
  )
}

export { Segmented, SegmentedItem, segmentedVariants }
