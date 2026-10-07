"use client"

import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible"
import { cn } from "@/lib/utils"

function Collapsible({ ...props }: CollapsiblePrimitive.Root.Props) {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />
}

/* The trigger reads as its heading's own text with a chevron that turns
   when open; the whole line is the hit area.
   "row": a full-width row in a list of sections (About): Title type, the
   chevron at the right, a Raised wash on hover, the focus ring inset so a
   panel's rounded clip doesn't cut it. */
function CollapsibleTrigger({
  className,
  variant = "inline",
  ...props
}: CollapsiblePrimitive.Trigger.Props & { variant?: "inline" | "row" }) {
  return (
    <CollapsiblePrimitive.Trigger
      data-slot="collapsible-trigger"
      data-variant={variant}
      className={cn(
        "cursor-pointer items-center gap-2 text-left outline-none pointer-coarse:min-h-11 hover:text-foreground focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring [&>svg]:size-4 [&>svg]:flex-none [&>svg]:text-muted-foreground [&>svg]:transition-transform data-panel-open:[&>svg]:rotate-180 motion-reduce:[&>svg]:transition-none",
        variant === "inline" && "-mx-1 -my-1 inline-flex rounded-md px-1 py-1 focus-visible:outline-offset-2",
        variant === "row" && "flex min-h-13 w-full justify-between gap-4 bg-transparent px-4.5 py-3 text-sm leading-snug font-semibold text-foreground transition-colors hover:bg-muted focus-visible:-outline-offset-2 motion-reduce:transition-none",
        className
      )}
      {...props}
    />
  )
}

/* "reveal": the opened body fades in and drops 4px into place (opacity and
   transform only; the height changes at once, per DESIGN.md Motion). */
function CollapsibleContent({
  className,
  variant = "plain",
  ...props
}: CollapsiblePrimitive.Panel.Props & { variant?: "plain" | "reveal" }) {
  return (
    <CollapsiblePrimitive.Panel
      data-slot="collapsible-content"
      className={cn(
        variant === "reveal" && "transition-[opacity,translate] duration-200 ease-[cubic-bezier(.2,.7,.3,1)] data-ending-style:opacity-0 data-ending-style:duration-150 data-starting-style:-translate-y-1 data-starting-style:opacity-0 motion-reduce:transition-none",
        className
      )}
      {...props}
    />
  )
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
