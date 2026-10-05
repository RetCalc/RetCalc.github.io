/* Old-vs-new checks (MIGRATION.md): each tool is opened on the current site
   (built from ../src, served from the repo root) and on the new one, given
   the same inputs, and its numbers and screenshots compared.

     npx playwright test                 # all tools, desktop and phone
     npx playwright test mortgage        # one tool

   Uses the Chrome installed on this machine. The new site is a production
   build (next build && next start), so run `npm run build` first. */
import { defineConfig, devices } from "@playwright/test";

export const OLD = "http://localhost:8761";
export const NEW = "http://localhost:3200";

export default defineConfig({
  testDir: "e2e",
  timeout: 300_000,
  fullyParallel: true,
  reporter: [["list"]],
  use: { channel: "chrome", headless: true },
  projects: [
    { name: "desktop", use: { viewport: { width: 1280, height: 900 } } },
    { name: "phone", use: { ...devices["Pixel 7"], channel: "chrome" } },
  ],
  webServer: [
    { command: "python3 -m http.server 8761 --directory ..", url: OLD + "/index.html", reuseExistingServer: true, stderr: "ignore" },
    { command: "npx next start -p 3200", url: NEW, reuseExistingServer: true },
  ],
});
