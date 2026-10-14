/* The tool list's view (lib/tools-view.ts) is applied by this inline script,
   above the list, before it paints, so a visit never flashes the other view.
   Kept apart from lib/tools-view.ts (client only) so the server page can
   import it, as lib/theme-script.ts is for the theme. */

export const TOOLS_VIEW_KEY = "tools-view", TOOLS_VIEW_VERSION = 1;
/** The attribute on <html> the stylesheet shows one view or the other from. */
export const TOOLS_VIEW_ATTR = "data-tools-view";

/** Plain ES5, so it runs anywhere, first. The key is lib/storage.ts's form. */
export const TOOLS_VIEW_SCRIPT = `try{var v=JSON.parse(localStorage.getItem("retcalc.${TOOLS_VIEW_KEY}.v${TOOLS_VIEW_VERSION}"));if(v==="compact"||v==="charts")document.documentElement.setAttribute("${TOOLS_VIEW_ATTR}",v)}catch(e){}`;
