"use client"

import * as React from "react"
import { Dialog as SheetPrimitive } from "@base-ui/react/dialog"
import { XIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

/* shadcn's Sheet on Base UI, in the site's look and only as the phone's
   bottom sheet: a Surface panel that rises from the bottom edge over the
   dimmed page, with a grabber, rounded top corners and room for the home
   indicator. It is as tall as its content up to most of the screen, then
   scrolls inside. The phone redesign's menus and explanations open in it
   (components/phone); nothing on a tablet or desktop uses it. */
function Sheet({ ...props }: SheetPrimitive.Root.Props) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger({ ...props }: SheetPrimitive.Trigger.Props) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({ ...props }: SheetPrimitive.Close.Props) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: SheetPrimitive.Popup.Props & { showCloseButton?: boolean }) {
  return (
    <SheetPrimitive.Portal data-slot="sheet-portal">
      <SheetPrimitive.Backdrop
        data-slot="sheet-overlay"
        className="fixed inset-0 z-95 bg-(--ds-scrim) transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0 motion-reduce:transition-none"
      />
      <SheetPrimitive.Popup
        data-slot="sheet-content"
        className={cn(
          "fixed inset-x-0 bottom-0 z-96 flex max-h-[88dvh] flex-col rounded-t-[22px] bg-card text-card-foreground shadow-(--ds-float-up) outline-none",
          "pr-[env(safe-area-inset-right,0px)] pb-[env(safe-area-inset-bottom,0px)] pl-[env(safe-area-inset-left,0px)]",
          "transition-transform duration-250 ease-[cubic-bezier(.2,.7,.3,1)] data-ending-style:translate-y-full data-starting-style:translate-y-full motion-reduce:transition-none",
          className
        )}
        {...props}
      >
        <span aria-hidden="true" className="mx-auto mt-2 mb-1 block h-1.25 w-9.5 flex-none rounded-full bg-border" />
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close
            data-slot="sheet-close"
            render={<Button variant="ghost" size="icon" className="absolute top-2.5 right-2.5" aria-label="Close" />}
          >
            <XIcon aria-hidden="true" />
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Popup>
    </SheetPrimitive.Portal>
  )
}

/* The sheet's title row. Leaves room at the right for the close button. */
function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sheet-header" className={cn("flex flex-none flex-col gap-0.5 px-5 pt-2 pr-14 pb-2", className)} {...props} />
}

/* The part that scrolls when the sheet is taller than the screen allows. */
function SheetBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sheet-body" className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5", className)} {...props} />
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sheet-footer" className={cn("flex flex-none flex-col gap-2 px-5 pt-2 pb-4", className)} {...props} />
}

function SheetTitle({ className, ...props }: SheetPrimitive.Title.Props) {
  return <SheetPrimitive.Title data-slot="sheet-title" className={cn("m-0 text-lg leading-snug font-semibold tracking-tight text-foreground", className)} {...props} />
}

function SheetDescription({ className, ...props }: SheetPrimitive.Description.Props) {
  return <SheetPrimitive.Description data-slot="sheet-description" className={cn("m-0 text-sm text-muted-foreground", className)} {...props} />
}

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetBody, SheetFooter, SheetTitle, SheetDescription }
