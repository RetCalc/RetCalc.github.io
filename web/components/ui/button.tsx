import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // The primary action: one per view, one of amber's four places.
        default: "bg-primary font-semibold text-primary-foreground hover:bg-[color-mix(in_oklch,var(--primary),var(--foreground)_12%)]",
        outline:
          "border-border bg-secondary text-secondary-foreground hover:border-muted-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_6%)] aria-pressed:border-muted-foreground aria-pressed:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
        secondary:
          "border-border bg-secondary text-secondary-foreground hover:border-muted-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_6%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-[color-mix(in_srgb,var(--destructive)_15%,var(--card))] text-destructive hover:border-destructive/50",
        // Text, underlined: links are never amber.
        link: "text-foreground underline decoration-muted-foreground underline-offset-4 hover:decoration-foreground",
        // A text link that stays out of the way: footer links, asides.
        quiet: "text-muted-foreground underline-offset-4 hover:text-foreground hover:underline",
      },
      size: {
        default:
          "h-9 gap-1.5 px-3 pointer-coarse:h-11 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        // Small (CSV); under a finger its hit area grows to 44px tall
        // without moving anything.
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs pointer-coarse:relative pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 pointer-coarse:after:-inset-y-3 pointer-coarse:after:content-[''] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 gap-1 px-2.5 text-[0.8rem] pointer-coarse:h-11 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-10 gap-1.5 px-3.5 pointer-coarse:h-11 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        icon: "size-9 pointer-coarse:size-11",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-9 pointer-coarse:size-11",
        "icon-lg": "size-10 pointer-coarse:size-11",
        // The size of the text around it, for a link-style button in a sentence.
        // Under a finger, a 44px-tall hit area around the words.
        inline: "h-auto gap-1.5 p-0 text-[length:inherit] pointer-coarse:relative pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 pointer-coarse:after:-inset-y-3 pointer-coarse:after:content-[''] [&_svg:not([class*='size-'])]:size-3.5",
        // A small text link on its own line, such as under the field it explains.
        "inline-xs": "h-auto gap-1.5 py-0.5 px-0 text-xs [&_svg:not([class*='size-'])]:size-3.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
