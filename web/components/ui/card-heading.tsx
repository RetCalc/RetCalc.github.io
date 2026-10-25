"use client"

import * as React from "react"

/* Card titles head a section of their page, so they're h2s; a tool shown
   inside another section (the Dashboard's Retirement tab) sets the level
   one down, so its titles are h3s under that section's h2. Kept apart from
   card.tsx, which server-rendered pages use too. */
export const CardHeadingLevel = React.createContext<2 | 3>(2)

export function CardHeading(props: React.ComponentProps<"h2">) {
  const Tag = React.useContext(CardHeadingLevel) === 3 ? "h3" : "h2"
  return <Tag {...props} />
}
