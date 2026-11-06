import { test } from "node:test";
import assert from "node:assert/strict";
import { optimizationExamples } from "./fixtures/optimization.ts";

import { enumerate, compare } from "./helpers/reference.ts";

for (const example of optimizationExamples) {
  test(example.name, () => {
    const plans = enumerate(example.request).sort(compare);
    if (example.expected.status === "infeasible") {
      assert.equal(plans.length, 0);
    } else {
      const expected = example.expected.plan;
      assert.ok(plans.length > 0);
      // Verify both feasibility/derived totals and the lexicographic optimum.
      assert.ok(plans.some(p => JSON.stringify(p) === JSON.stringify(expected)));
      assert.equal(compare(expected, plans[0]), 0);
    }
  });
}
