import { createCn } from "cn/config"

/* `cn` (clsx + tailwind-merge), taught the theme's own text sizes
   (app/globals.css: text-fine, text-label, text-note, text-aside,
   text-body, text-body-lg, text-display). Without this, merging read them
   as colors, so `text-label` beside `text-muted-foreground` was dropped. */
export const cn = createCn({
  extend: { classGroups: { "font-size": [{ text: ["fine", "label", "note", "aside", "body", "body-lg", "display"] }] } },
})
