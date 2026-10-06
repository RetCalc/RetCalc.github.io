"use client"

import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible"
import { cn } from "@/lib/utils"

function Collapsible({ ...props }: CollapsiblePrimitive.Root.Props) {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />
}

/* The trigger reads as its heading's own text with a chevron that turns
   when open; the whole line is the hit area. */
function CollapsibleTrigger({ className, ...props }: CollapsiblePrimitive.Trigger.Props) {
  return (
    <CollapsiblePrimitive.Trigger
      data-slot="collapsible-trigger"
      className={cn(
        "-mx-1 -my-1 inline-flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-left outline-none pointer-coarse:min-h-11 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring [&>svg]:size-4 [&>svg]:text-muted-foreground [&>svg]:transition-transform data-panel-open:[&>svg]:rotate-180 motion-reduce:[&>svg]:transition-none",
        className
      )}
      {...props}
    />
  )
}

function CollapsibleContent({ ...props }: CollapsiblePrimitive.Panel.Props) {
  return (
    <CollapsiblePrimitive.Panel data-slot="collapsible-content" {...props} />
  )
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
