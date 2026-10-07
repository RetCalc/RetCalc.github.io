"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { cva, type VariantProps } from "class-variance-authority"

/* shadcn's Dialog on Base UI, in the site's look: a Surface card with the
   Float shadow over a dimmed, scrollable viewport, centered while it fits
   and scrolling with the page once it doesn't.

   The popup keeps the class `popup` (and `wide` on the form sizes), and the
   viewport `popup-overlay`: the dialogs' own content rules
   and the e2e checks find them by those names. */
function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

const dialogContentVariants = cva(
  "popup relative m-auto w-full rounded-(--r-bezel) border border-border bg-card px-6 pt-5.5 pb-4.5 text-card-foreground shadow-(--ds-float) outline-none animate-[popIn_.2s_cubic-bezier(.2,.7,.3,1)] motion-reduce:animate-none",
  {
    variants: {
      size: {
        default: "max-w-85",
        /* forms: the converter, growth rates, asset mix, item editor */
        wide: "wide max-w-105",
        /* a reading dialog: the strategy guide */
        guide: "max-w-195 px-6.5 pb-5 max-sm:px-4 max-sm:pt-4.5 max-sm:pb-4.5",
        /* the classic studies */
        study: "wide max-w-160",
      },
    },
    defaultVariants: { size: "default" },
  }
)

function DialogContent({
  size = "default",
  children,
  ...props
}: DialogPrimitive.Popup.Props & VariantProps<typeof dialogContentVariants>) {
  return (
    <DialogPrimitive.Portal data-slot="dialog-portal">
      <DialogPrimitive.Viewport
        data-slot="dialog-viewport"
        className="popup-overlay fixed inset-0 z-90 flex items-start justify-center overflow-y-auto bg-(--ds-scrim) p-5 animate-[ovFade_.16s_ease] motion-reduce:animate-none"
      >
        <DialogPrimitive.Popup
          data-slot="dialog-content"
          className={dialogContentVariants({ size })}
          {...props}
        >
          {children}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Viewport>
    </DialogPrimitive.Portal>
  )
}

export { Dialog, DialogClose, DialogContent, dialogContentVariants }
