/* Reading a saved copy of the children (tools/plan/kidsRead.ts). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readKids } from "@/tools/stages/kids";

test("a damaged saved copy reads as no children", () => {
  assert.equal(readKids(null), null);
  assert.equal(readKids({ now: "two" }), null);
  assert.deepEqual(readKids({ now: [3, 99, -1], planned: 9, firstIn: 1 })!.now, [3]);
});
