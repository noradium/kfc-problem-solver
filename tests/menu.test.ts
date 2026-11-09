import { test } from "node:test";
import assert from "node:assert/strict";
import { catalog, bundleSnapshot } from "../app/data/catalog.ts";
import { expandBundle, prepareCatalog, isAvailable, type MenuCatalog } from "../app/domain/menu.ts";
import { enumerate, compare } from "./helpers/reference.ts";

test("pack side counts, repeated choices and per-item upgrade prices are exact", () => {
  for (const [id, count] of [[32863, 2], [32864, 3], [32865, 4]]) {
    const variants = catalog.offers.filter(offer => offer.officialId === `I-0000${id}-007`);
    assert.ok(variants.length > 0);
    assert.ok(variants.every(offer => offer.selections.reduce((sum, item) => sum + item.quantity, 0) === count));
    const largePotatoes = variants.find(offer => offer.selections.length === 1 && offer.selections[0].productId === 32118)!;
    assert.equal(largePotatoes.selections[0].quantity, count);
    assert.equal(largePotatoes.priceYen, largePotatoes.basePriceYen + count * 200);
  }
  const mixed = catalog.offers.find(offer => offer.officialId === "I-000032863-007"
    && offer.selections.some(item => item.productId === 29147 && item.quantity === 1)
    && offer.selections.some(item => item.productId === 29151 && item.quantity === 1));
  assert.ok(mixed);
  assert.equal(mixed.priceYen, 1590);
  const tasting = bundleSnapshot.bundles.find(bundle => bundle.officialId === "I-000032229-007")!;
  assert.equal(tasting.groups[0].quantity, 2);
});

test("sauce counts, nugget pack units and kids substitutions remain realizable", () => {
  const sauces = catalog.offers.filter(offer => offer.officialId === "I-000032408-007");
  assert.ok(sauces.length > 0);
  for (const offer of sauces) {
    assert.equal(offer.items.find(item => item.productId === 29155)?.quantity, 1);
    assert.equal(offer.items.find(item => item.productId === 1000001)?.quantity, 1);
    for (const id of [1000002, 1000003, 1000004]) assert.equal(offer.items.find(item => item.productId === id)?.quantity, 1);
  }
  const boneless = catalog.offers.find(offer => offer.officialId === "I-000032923-007"
    && [31788, 32118, 32125].every(id => offer.items.some(item => item.productId === id)))!;
  assert.ok(boneless);
  assert.equal(boneless.priceYen, 590 + 20 + 200 + 70);
  assert.ok(!boneless.items.some(item => item.productId === 32115));
});

test("bundle expansion does not multiply permutations or duplicate distinct choices", () => {
  const bundle = { officialId: "I-000099999-007", priceYen: 100, fixedItems: [],
    groups: [{ groupId: "side", quantity: 2 }], sources: [{ sourceUrl: "https://www.kfc.co.jp/menu" }] };
  const groups = { side: { name: "side", options: [{ productId: 1, extraPriceYen: 0 }, { productId: 2, extraPriceYen: 20 }] } };
  assert.deepEqual(expandBundle(bundle, groups, "set").map(offer => offer.priceYen), [100, 120, 140]);
  const distinct = { ...bundle, groups: [{ groupId: "side", quantity: 2, distinct: true }] };
  assert.equal(expandBundle(distinct, groups, "set").length, 1);
});

test("known sale dates are inclusive and expired barrels cannot be purchased", () => {
  const barrel = bundleSnapshot.bundles.find(bundle => bundle.officialId === "I-000032778-007")!;
  for (const date of ["2026-11-02", "2026-11-10"]) assert.equal(isAvailable(barrel, date), true);
  for (const date of ["2026-11-01", "2026-11-11"]) {
    assert.equal(isAvailable(barrel, date), false);
    assert.ok(!prepareCatalog(catalog, [{ productId: 32115, quantity: 9 }], date).offers.some(offer => offer.officialId === barrel.officialId));
  }
  assert.throws(() => prepareCatalog(catalog, [], "2026-02-30"), /購入日/);
});

test("demand pruning preserves price, surplus and unit objectives against exhaustive enumeration", () => {
  let seed = 123;
  const random = (n: number) => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % n; };
  for (let iteration = 0; iteration < 30; iteration++) {
    const small: MenuCatalog = { products: [{ id: 1, name: "A" }, { id: 2, name: "B" }, { id: 3, name: "Extra" }],
      offers: Array.from({ length: 4 }, (_, index) => ({ id: index + 1, name: `offer${index}`, priceYen: random(6),
        items: [{ productId: 1, quantity: random(3) }, { productId: 2, quantity: random(3) }, { productId: 3, quantity: random(3) }].filter(item => item.quantity > 0),
        kind: "bundle" as const, officialId: `I-00000000${index}-007`, basePriceYen: 0, selections: [], sourceUrl: "https://www.kfc.co.jp/menu",
      })).filter(offer => offer.items.length > 0) };
    const demand = [{ productId: 1, quantity: random(3) }, { productId: 2, quantity: random(3) }].filter(item => item.quantity > 0);
    const expected = enumerate({ schemaVersion: 1, catalog: small, demand }).sort(compare)[0];
    const prepared = prepareCatalog(small, demand, "2026-11-09");
    const actual = enumerate({ schemaVersion: 1, catalog: prepared, demand }).sort(compare)[0];
    assert.equal(!!actual, !!expected);
    if (actual && expected) assert.equal(compare(actual, expected), 0);
    assert.ok(prepared.offers.every(offer => small.offers.includes(offer)));
  }
});
