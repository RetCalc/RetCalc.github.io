/* What's new (releases.ts): the newest release is the site's version, and
   the list runs newest first with every version once. Fails a release
   whose package.json and What's new disagree. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { CURRENT, RELEASES } from "../releases";

const parts = (v: string) => v.split(".").map(Number);
const newer = (a: string, b: string) => { const [x, y] = [parts(a), parts(b)]; for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i]; return false; };

test("package.json's version is the newest release", () => {
  const pkg = JSON.parse(readFileSync(new URL("../../../package.json", import.meta.url), "utf8"));
  assert.equal(pkg.version, CURRENT.version);
});

test("versions are major.minor.patch, newest first, each once", () => {
  for (const r of RELEASES) assert.match(r.version, /^\d+\.\d+\.\d+$/, r.version);
  for (let i = 1; i < RELEASES.length; i++) {
    assert.ok(newer(RELEASES[i - 1].version, RELEASES[i].version), `${RELEASES[i - 1].version} should be newer than ${RELEASES[i].version}`);
    assert.ok(RELEASES[i - 1].date >= RELEASES[i].date, `${RELEASES[i - 1].version}'s date runs backwards`);
  }
});

test("every release has a date and a headline", () => {
  for (const r of RELEASES) {
    assert.match(r.date, /^\d{4}-\d{2}-\d{2}$/, r.version);
    assert.ok(r.title.trim().length > 0, r.version);
  }
});
