import { test } from "node:test";
import assert from "node:assert/strict";
import type { OptimizationRequest, PurchasePlan } from "../app/domain/optimization.ts";
import { optimizationExamples } from "./fixtures/optimization.ts";

// Test-only exhaustive oracle for tiny fixtures, NOT the application solver.
// Covers every vector with sum(x) <= sum(demand); see docs for the bound.
function enumerate(request: OptimizationRequest): PurchasePlan[] {
  const { catalog, demand } = request;
  const maxUnits = demand.reduce((n, item) => n + item.quantity, 0);
  const plans: PurchasePlan[] = [];
  const counts = catalog.offers.map(() => 0);
  function visit(index: number, remaining: number) {
    if (index < counts.length) {
      for (let count = 0; count <= remaining; count++) {
        counts[index] = count;
        visit(index + 1, remaining - count);
      }
      return;
    }
    const wanted = new Map(demand.map(item => [item.productId, item.quantity]));
    const supplied = new Map(catalog.products.map(p => [p.id, 0]));
    catalog.offers.forEach((offer, i) => {
      offer.items.forEach(item => supplied.set(item.productId, supplied.get(item.productId)! + item.quantity * counts[i]));
    });
    if (demand.some(item => supplied.get(item.productId)! < item.quantity)) return;
    const surplus = catalog.products.map(p => ({ productId: p.id, quantity: supplied.get(p.id)! - (wanted.get(p.id) ?? 0) }))
      .filter(item => item.quantity > 0).sort((a, b) => a.productId - b.productId);
    plans.push({
      purchases: catalog.offers.map((offer, i) => ({ offerId: offer.id, quantity: counts[i] }))
        .filter(line => line.quantity > 0).sort((a, b) => a.offerId - b.offerId),
      totalPriceYen: catalog.offers.reduce((n, offer, i) => n + offer.priceYen * counts[i], 0),
      surplus,
      totalSurplusQuantity: surplus.reduce((n, item) => n + item.quantity, 0),
      totalOfferQuantity: counts.reduce((a, b) => a + b, 0),
    });
  }
  visit(0, maxUnits);
  return plans;
}
function compare(a: PurchasePlan, b: PurchasePlan) {
  return a.totalPriceYen - b.totalPriceYen ||
    a.totalSurplusQuantity - b.totalSurplusQuantity || a.totalOfferQuantity - b.totalOfferQuantity;
}

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
