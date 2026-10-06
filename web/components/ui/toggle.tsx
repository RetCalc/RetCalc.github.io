"use client"

import { Toggle as TogglePrimitive } from "@base-ui/react/toggle"
import { cva, type VariantProps } from "class-variance-authority"
import { CheckIcon } from "lucide-react"
import { cn } from "@/lib/utils"

/* A two-state button (shadcn's Toggle, on Base UI): a native <button>, so
   Enter and Space both flip it and it's its own Tab stop. `pressed` is the
   state; the chosen look also gets the class `on` for the legacy layout
   rules and scripts that look for it.

   - check: "Glide path", "Split by account type": a checkbox-style button
     that opens a group of fields (put a ToggleCheck first).
   - sign: the ± in front of a rate; on (loss) when the rate is negative.
   - legend: a chart legend entry that shows or hides a layer; struck
     through and faded when off. */
const toggleVariants = cva(
  "group/toggle cursor-pointer outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        check:
          "flex w-full items-center gap-2.5 rounded-(--r-well) border border-border bg-muted px-2.5 py-2.25 text-left text-[12.5px] text-muted-foreground transition-colors hover:border-input focus-visible:outline-offset-2 data-pressed:border-input",
        sign:
          "flex-none bg-transparent px-2 text-sm leading-none text-muted-foreground transition-colors pointer-coarse:px-3.25 hover:text-foreground focus-visible:-outline-offset-2 data-pressed:text-loss",
        legend:
          "rounded-sm transition-opacity hover:text-foreground focus-visible:outline-offset-3 not-data-pressed:line-through not-data-pressed:opacity-45",
      },
    },
    defaultVariants: { variant: "check" },
  }
)

function Toggle({
  className,
  variant = "check",
  pressed,
  ...props
}: TogglePrimitive.Props & VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive
      data-slot="toggle"
      data-variant={variant}
      pressed={pressed}
      className={cn(toggleVariants({ variant }), pressed && "on", className)}
      {...props}
    />
  )
}

/** The box at the start of a `check` toggle, ticked while it's pressed. */
function ToggleCheck({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="toggle-check"
      aria-hidden="true"
      className={cn(
        "glidebtn-check grid size-4 place-content-center rounded-[5px] border-[1.5px] border-muted-foreground text-card transition-colors group-data-pressed/toggle:border-foreground group-data-pressed/toggle:bg-foreground [&>svg]:size-3 [&>svg]:stroke-3 [&>svg]:opacity-0 group-data-pressed/toggle:[&>svg]:opacity-100",
        className
      )}
      {...props}
    >
      <CheckIcon />
    </span>
  )
}

export { Toggle, ToggleCheck, toggleVariants }
