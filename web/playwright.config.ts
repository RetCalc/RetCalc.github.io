/* Browser checks of the site's behaviour: tools clearing, handing figures
   on, charts following the pointer, the Guide's trips and printing.

     npx playwright test                 # every check, desktop and phone
     npx playwright test drawdown        # one spec file

   Uses the Chrome installed on this machine. The site is a production
   build (next build && next start), so run `npm run build` first. */
import { defineConfig, devices } from "@playwright/test";

export const NEW = "http://localhost:3200";

export default defineConfig({
  testDir: "e2e",
  timeout: 120_000,
  fullyParallel: true,
  // One retry covers a page that stalls when many checks run at once; the
  // report marks the test "flaky" so it's never silent.
  retries: 1,
  reporter: [["list"]],
  // Reduced motion: figures land on their value at once, so a
  // page in the background never stops mid-count.
  use: { channel: "chrome", headless: true, actionTimeout: 15_000, navigationTimeout: 30_000, contextOptions: { reducedMotion: "reduce" } },
  projects: [
    { name: "desktop", use: { viewport: { width: 1280, height: 900 } } },
    { name: "phone", use: { ...devices["Pixel 7"], channel: "chrome" } },
  ],
  webServer: [
    { command: "npx next start -p 3200", url: NEW, reuseExistingServer: true },
  ],
});
