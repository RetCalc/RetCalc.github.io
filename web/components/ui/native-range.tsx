import * as React from "react"
import { cn } from "@/lib/utils"

/* A native <input type="range">, in the manner of NativeSelect. shadcn's
   Slider (Base UI) isn't used: Shift+Arrow there jumps by its large step
   where the native control moves by one, and it puts the id on a hidden
   input behind a thumb, so the keyboard and the field's id would both
   change. A 6px track in the strong edge's tone inside a taller hit area
   (24px, 44px under a finger), and a thumb in the text color that grows
   under the pointer; no glow. */
function NativeRange({ className, ...props }: Omit<React.ComponentProps<"input">, "type">) {
  return (
    <input
      type="range"
      data-slot="native-range"
      className={cn(
        "m-0 block h-6 w-full cursor-pointer appearance-none bg-transparent outline-none pointer-coarse:h-11",
        "[&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-[3px] [&::-webkit-slider-runnable-track]:bg-input",
        "[&::-webkit-slider-thumb]:-mt-[7px] [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-3 [&::-webkit-slider-thumb]:border-solid [&::-webkit-slider-thumb]:border-card [&::-webkit-slider-thumb]:bg-foreground [&::-webkit-slider-thumb]:transition-transform hover:[&::-webkit-slider-thumb]:scale-115 active:[&::-webkit-slider-thumb]:scale-115 focus-visible:[&::-webkit-slider-thumb]:shadow-[0_0_0_2px_var(--card),0_0_0_4px_var(--ring)]",
        "[&::-moz-range-track]:h-1.5 [&::-moz-range-track]:rounded-[3px] [&::-moz-range-track]:bg-input",
        "[&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-3 [&::-moz-range-thumb]:border-solid [&::-moz-range-thumb]:border-card [&::-moz-range-thumb]:bg-foreground focus-visible:[&::-moz-range-thumb]:shadow-[0_0_0_2px_var(--card),0_0_0_4px_var(--ring)]",
        className
      )}
      {...props}
    />
  )
}

export { NativeRange }
