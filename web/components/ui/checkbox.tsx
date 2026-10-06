"use client"

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox"
import { cn } from "@/lib/utils"
import { CheckIcon } from "lucide-react"

/* A checkbox: 15px, a strong edge on Ground, filled with Text when checked
   (not amber: a setting being on isn't the answer). Base UI keeps a hidden
   native input beside it, which takes the `id`, so a <label> around it,
   getElementById(id).checked and form reads work as before; data attributes
   stay on the visible box. Space toggles it and Enter doesn't, as on a
   native checkbox. */
function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer relative flex size-3.75 shrink-0 cursor-pointer items-center justify-center rounded-[3px] border border-input bg-background text-background transition-colors outline-none after:absolute after:-inset-x-2 after:-inset-y-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 data-checked:border-foreground data-checked:bg-foreground",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none [&>svg]:size-3 [&>svg]:stroke-3"
      >
        <CheckIcon />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
