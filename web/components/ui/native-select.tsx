import * as React from "react"
import { ChevronDownIcon } from "lucide-react"
import { cn } from "@/lib/utils"

type NativeSelectProps = Omit<React.ComponentProps<"select">, "size"> & {
  size?: "sm" | "default"
  /** "joined": one segment of a joined toolbar (the scenario picker beside
      Save, Share and Reset): it fills the toolbar's height, draws no edge or
      corners of its own, and its focus ring sits inside, since the toolbar
      clips what spills over. */
  variant?: "default" | "joined"
}

/* A native <select>, so its value, change events and the site's own
   dropdown list (lib/select-menus.js, which opens over any <select>) all
   work as before. Full width, like the fields it sits among; `className`
   styles the wrapper, and a context that needs a narrower or joined select
   says so there. */
function NativeSelect({
  className,
  size = "default",
  variant = "default",
  ...props
}: NativeSelectProps) {
  return (
    <div
      className={cn(
        "group/native-select relative w-full",
        /* The joined scenario picker is disabled on pages without a tool
           (Tools, About, Compare, 404) while its neighbours aren't; it keeps
           their look there, so the toolbar reads the same on every page. */
        variant !== "joined" && "has-[select:disabled]:opacity-50",
        className
      )}
      data-slot="native-select-wrapper"
      data-size={size}
      data-variant={variant}
    >
      <select
        data-slot="native-select"
        data-size={size}
        data-variant={variant}
        className="h-9 w-full min-w-0 cursor-pointer appearance-none truncate rounded-lg border border-input bg-background py-1 pr-8 pl-3 text-[13px] text-foreground max-sm:text-base transition-colors outline-none pointer-coarse:h-11 hover:border-muted-foreground focus-visible:border-foreground focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:cursor-not-allowed aria-invalid:border-destructive data-[size=sm]:h-8 data-[size=sm]:pointer-coarse:h-11 data-[variant=joined]:h-full data-[variant=joined]:rounded-none data-[variant=joined]:border-0 data-[variant=joined]:focus-visible:-outline-offset-2"
        {...props}
      />
      <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground select-none" aria-hidden="true" data-slot="native-select-icon" />
    </div>
  )
}

function NativeSelectOption({
  className,
  ...props
}: React.ComponentProps<"option">) {
  return (
    <option
      data-slot="native-select-option"
      className={cn("bg-[Canvas] text-[CanvasText]", className)}
      {...props}
    />
  )
}

function NativeSelectOptGroup({
  className,
  ...props
}: React.ComponentProps<"optgroup">) {
  return (
    <optgroup
      data-slot="native-select-optgroup"
      className={cn("bg-[Canvas] text-[CanvasText]", className)}
      {...props}
    />
  )
}

export { NativeSelect, NativeSelectOptGroup, NativeSelectOption }
