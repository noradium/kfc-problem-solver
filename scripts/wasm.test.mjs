import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
test("built WASM exports the supported browser ABI", async () => {
  const { instance } = await WebAssembly.instantiate(await readFile("public/wasm/kfc_solver.wasm"));
  assert.equal(instance.exports.solver_version(), 1);
});
