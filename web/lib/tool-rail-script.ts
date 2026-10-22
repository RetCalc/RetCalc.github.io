/* Whether the tools' sidebar (components/shell/ToolRail.tsx) is hidden is
   applied by this inline script in <head>, before the page paints, so a
   visit never shows the sidebar and then takes it away. Kept apart from
   lib/tool-rail.ts (client only) so the server layout can import it, as
   lib/theme-script.ts is for the theme. */

export const TOOL_RAIL_KEY = "tool-rail", TOOL_RAIL_VERSION = 1;
/** The attribute on <html> the stylesheet folds the sidebar from. */
export const TOOL_RAIL_ATTR = "data-tool-rail";

/** Plain ES5, so it runs anywhere, first. The key is lib/storage.ts's form. */
export const TOOL_RAIL_SCRIPT = `try{if(JSON.parse(localStorage.getItem("retcalc.${TOOL_RAIL_KEY}.v${TOOL_RAIL_VERSION}"))==="hidden")document.documentElement.setAttribute("${TOOL_RAIL_ATTR}","hidden")}catch(e){}`;
