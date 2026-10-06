/* Light, dark, or follow the system. The choice is stored in this browser
   and applied before first paint by THEME_SCRIPT (lib/theme-script.ts).
   Client components only. Ported from src/js/app/19-widgets-theme.js. */
import { useSyncExternalStore } from "react";
import { THEME_KEY } from "@/lib/theme-script";

export type ThemeChoice = "light" | "dark" | "system";
export type Theme = "light" | "dark";

const THEME_COLOR: Record<Theme, string> = { dark: "#080b16", light: "#eceef4" };

export function resolveTheme(choice: ThemeChoice): Theme {
  if (choice !== "system") return choice;
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function readThemeChoice(): ThemeChoice {
  try {
    const v = JSON.parse(localStorage.getItem(THEME_KEY) ?? '"system"');
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

const choiceListeners = new Set<() => void>();

/** Shows `choice` now and remembers it. */
export function setThemeChoice(choice: ThemeChoice): void {
  try {
    if (choice === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, JSON.stringify(choice));
  } catch {
    /* applies for this visit only */
  }
  applyTheme(resolveTheme(choice));
  choiceListeners.forEach((l) => l());
}

/** The choice stored: light, dark or the system's; "system" before hydration. */
export function useThemeChoice(): ThemeChoice {
  return useSyncExternalStore(
    (l) => { choiceListeners.add(l); return () => choiceListeners.delete(l); },
    readThemeChoice,
    () => "system",
  );
}

/* Native controls (checkboxes, scrollbars) and the phone's browser chrome
   follow these meta tags rather than the page's CSS. */
export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[theme]);
  document.querySelector('meta[name="color-scheme"]')?.setAttribute("content", theme);
}

function subscribe(onChange: () => void) {
  const obs = new MutationObserver(onChange);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => obs.disconnect();
}

/** The theme showing now, or null before the page has hydrated. */
export function useTheme(): Theme | null {
  return useSyncExternalStore(
    subscribe,
    () => (document.documentElement.getAttribute("data-theme") as Theme) ?? "dark",
    () => null,
  );
}
