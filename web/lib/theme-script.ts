/* The theme is applied by this inline script in <head>, before the page
   paints, so a light-theme visitor never sees a flash of dark. Kept apart
   from lib/theme.ts (client only) so the server layout can import it. */

export const THEME_KEY = "retcalc.theme.v1";
/* Inlined into <head>. Plain ES5 so it runs anywhere, first. */
export const THEME_SCRIPT = `(function(){var c="system";try{var v=JSON.parse(localStorage.getItem(${JSON.stringify(THEME_KEY)}));if(v==="light"||v==="dark")c=v}catch(e){}var t=c!=="system"?c:(window.matchMedia&&matchMedia("(prefers-color-scheme: light)").matches?"light":"dark");document.documentElement.setAttribute("data-theme",t)})();`;

/* Flags the installed home-screen web app (html.pwa) so the phone's bottom
   tab bar applies there only, not in a Safari tab, which has its own bottom
   toolbar. Inlined beside the theme script, before first paint, so the top
   rail never flashes. navigator.standalone covers every iOS version;
   display-mode covers newer iOS and other platforms' installed apps. */
export const STANDALONE_SCRIPT = `(function(){try{if(navigator.standalone===true||(window.matchMedia&&matchMedia("(display-mode: standalone)").matches))document.documentElement.classList.add("pwa")}catch(e){}})();`;
