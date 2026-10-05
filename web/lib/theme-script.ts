/* The theme is applied by this inline script in <head>, before the page
   paints, so a light-theme visitor never sees a flash of dark. Kept apart
   from lib/theme.ts (client only) so the server layout can import it. */

export const THEME_KEY = "retcalc.theme.v1";
/* Inlined into <head>. Plain ES5 so it runs anywhere, first. */
export const THEME_SCRIPT = `(function(){var c="system";try{var v=JSON.parse(localStorage.getItem(${JSON.stringify(THEME_KEY)}));if(v==="light"||v==="dark")c=v}catch(e){}var t=c!=="system"?c:(window.matchMedia&&matchMedia("(prefers-color-scheme: light)").matches?"light":"dark");document.documentElement.setAttribute("data-theme",t)})();`;
