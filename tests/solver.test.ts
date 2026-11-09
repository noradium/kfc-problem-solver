import { test } from "node:test";
import { isDeepStrictEqual } from "node:util";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { instantiateSolver } from "../app/lib/wasm-api.ts";
import type { OptimizationRequest } from "../app/domain/optimization";
import { optimizationExamples } from "./fixtures/optimization.ts";
import { compare, enumerate } from "./helpers/reference.ts";
import { catalog } from "../app/data/catalog.ts";
import { prepareCatalog } from "../app/domain/menu.ts";
const solve = await instantiateSolver(await readFile("public/wasm/kfc_solver.wasm"));
for (const example of optimizationExamples) {
  test(`WASM: ${example.name}`, () => {
    const actual = solve(example.request);
    assert.equal(actual.status, example.expected.status);
    if (actual.status === "optimal" && example.expected.status === "optimal") {
      assert.equal(compare(actual.plan, example.expected.plan), 0);
      assert.ok(enumerate(example.request).some(p => isDeepStrictEqual(p, actual.plan)));
    }
  });
}
const input = () => structuredClone(optimizationExamples[2].request);
test("invalid input is rejected at the actual WASM boundary", () => {
  const cases: [string, (v: any) => void][] = [
    ["unsupported_schema", v => { v.schemaVersion = 2; }],
    ["invalid_structure", v => { delete v.catalog; }],
    ["invalid_structure", v => { v.catalog.products[0].name = " "; }],
    ["invalid_number", v => { v.demand[0].quantity = -1; }],
    ["invalid_number", v => { v.catalog.offers[0].priceYen = 0.5; }],
    ["limit_exceeded", v => { v.demand[0].quantity = 101; }],
    ["duplicate_id", v => { v.catalog.products.push(v.catalog.products[0]); }],
    ["duplicate_product", v => { v.demand.push(v.demand[0]); }],
    ["duplicate_product", v => { v.catalog.offers[0].items.push(v.catalog.offers[0].items[0]); }],
    ["unknown_product", v => { v.demand[0].productId = 999; }],
    ["empty_offer", v => { v.catalog.offers[0].items = []; }],
  ];
  for (const [code, mutate] of cases) {
    const value = input(); mutate(value);
    const result = solve(value);
    assert.equal(result.status, "invalid_input");
    if (result.status === "invalid_input") assert.equal(result.code, code);
  }
});
test("budget exhaustion never claims optimality, even after a feasible solution", () => {
  assert.deepEqual(solve(input(), 0), { status: "time_limit", incumbent: null });
  const result = solve(input(), 4);
  assert.equal(result.status, "time_limit");
  if (result.status === "time_limit") {
    assert.ok(result.incumbent);
    assert.ok(enumerate(input()).some(p => isDeepStrictEqual(p, result.incumbent)));
  }
});
test("random small problems match an independent exhaustive oracle", () => {
  let seed = 42;
  const random = (max: number) => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % max; };
  for (let i = 0; i < 80; i++) {
    const request: OptimizationRequest = { schemaVersion: 1, catalog: {
      products: [{ id: 1, name: "A" }, { id: 2, name: "B" }],
      offers: Array.from({ length: 3 }, (_, j) => ({ id: j + 1, name: `offer${j}`, priceYen: random(6),
        items: [{ productId: 1, quantity: random(3) }, { productId: 2, quantity: random(3) }].filter(item => item.quantity > 0),
      })).filter(o => o.items.length > 0),
    }, demand: [{ productId: 1, quantity: random(3) }, { productId: 2, quantity: random(3) }].filter(item => item.quantity > 0) };
    const expected = enumerate(request).sort(compare);
    const actual = solve(request);
    assert.equal(actual.status, expected.length ? "optimal" : "infeasible", JSON.stringify(request));
    if (actual.status === "optimal") {
      assert.equal(compare(actual.plan, expected[0]), 0, JSON.stringify(request));
      assert.ok(expected.some(p => isDeepStrictEqual(p, actual.plan)));
    }
  }
});
test("prices exceeding 32 bit remain exact", () => {
  const products = Array.from({ length: 50 }, (_, i) => ({ id: i + 1, name: `p${i}` }));
  const request: OptimizationRequest = { schemaVersion: 1, catalog: { products,
    offers: products.map(p => ({ id: p.id, name: p.name, priceYen: 1_000_000, items: [{ productId: p.id, quantity: 1 }] })),
  }, demand: products.map(p => ({ productId: p.id, quantity: 100 })) };
  const result = solve(request);
  assert.equal(result.status, "optimal");
  if (result.status === "optimal") assert.equal(result.plan.totalPriceYen, 5_000_000_000);
});

test("official bundles beat singles, combine with singles and charge every upgrade", () => {
  const cases: { demand: [number, number][]; price: number; bundle: string; surplus: number }[] = [
    { demand: [[32115, 4], [29147, 2]], price: 1590, bundle: "I-000032863-007", surplus: 0 },
    { demand: [[32115, 5], [29147, 2]], price: 1920, bundle: "I-000032863-007", surplus: 0 },
    { demand: [[32115, 4], [29147, 1], [29151, 1]], price: 1590, bundle: "I-000032863-007", surplus: 0 },
    { demand: [[31782, 1], [29147, 1], [32124, 1]], price: 890, bundle: "I-000032613-007", surplus: 0 },
    { demand: [[31782, 1], [32118, 1], [32125, 1]], price: 1140, bundle: "I-000032613-007", surplus: 0 },
    { demand: [[31788, 1], [32118, 1], [32125, 1]], price: 880, bundle: "I-000032923-007", surplus: 1 },
    { demand: [[1000001, 1], [29147, 1]], price: 590, bundle: "I-000032351-007", surplus: 1 },
    { demand: [[32115, 9]], price: 2590, bundle: "I-000032778-007", surplus: 0 },
  ];
  for (const example of cases) {
    const demand = example.demand.map(([productId, quantity]) => ({ productId, quantity }));
    const prepared = prepareCatalog(catalog, demand, "2026-11-09");
    const result = solve({ schemaVersion: 1, catalog: prepared, demand });
    assert.equal(result.status, "optimal", JSON.stringify(example));
    if (result.status !== "optimal") continue;
    assert.equal(result.plan.totalPriceYen, example.price);
    assert.equal(result.plan.totalSurplusQuantity, example.surplus);
    assert.ok(result.plan.purchases.some(line => prepared.offers.find(offer => offer.id === line.offerId)?.officialId === example.bundle));
    const supplied = new Map<number, number>();
    let price = 0, units = 0;
    for (const line of result.plan.purchases) {
      const offer = prepared.offers.find(offer => offer.id === line.offerId)!;
      price += offer.priceYen * line.quantity; units += line.quantity;
      for (const item of offer.items) supplied.set(item.productId, (supplied.get(item.productId) ?? 0) + item.quantity * line.quantity);
    }
    assert.equal(price, result.plan.totalPriceYen);
    assert.equal(units, result.plan.totalOfferQuantity);
    assert.ok(demand.every(item => supplied.get(item.productId)! >= item.quantity));
  }
});

test("expanded menu offer limit is enforced at the WASM boundary", () => {
  const request: OptimizationRequest = { schemaVersion: 1, catalog: { products: [{ id: 1, name: "item" }],
    offers: Array.from({ length: 5001 }, (_, index) => ({ id: index + 1, name: "offer", priceYen: 1, items: [{ productId: 1, quantity: 1 }] })),
  }, demand: [{ productId: 1, quantity: 1 }] };
  assert.deepEqual(solve(request).status, "invalid_input");
  request.catalog.offers.pop();
  assert.deepEqual(solve(request, 0), { status: "time_limit", incumbent: null });
});
