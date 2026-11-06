import { test } from "node:test";
import assert from "node:assert/strict";
import { catalog, catalogMetadata } from "../app/data/catalog.ts";
import { OPTIMIZATION_LIMITS as limits } from "../app/domain/optimization.ts";

// Runs whenever the handwritten menu is changed; external input validation
// at the solver boundary remains a separate task.
test("static menu satisfies the optimization input contract", () => {
  const validInteger = (n: number, min: number, max: number) => {
    assert.ok(Number.isSafeInteger(n) && n >= min && n <= max);
  };
  assert.ok(catalog.products.length <= limits.products);
  assert.ok(catalog.offers.length <= limits.offers);
  const productIds = new Set<number>();
  for (const product of catalog.products) {
    validInteger(product.id, 1, Number.MAX_SAFE_INTEGER);
    assert.ok(product.name.trim());
    assert.ok(!productIds.has(product.id));
    productIds.add(product.id);
  }
  const offerIds = new Set<number>();
  for (const offer of catalog.offers) {
    validInteger(offer.id, 1, Number.MAX_SAFE_INTEGER);
    assert.ok(!offerIds.has(offer.id));
    offerIds.add(offer.id);
    assert.ok(offer.name.trim());
    validInteger(offer.priceYen, 0, limits.priceYen);
    assert.ok(offer.items.length > 0);
    const itemIds = new Set<number>();
    for (const item of offer.items) {
      assert.ok(productIds.has(item.productId));
      assert.ok(!itemIds.has(item.productId));
      itemIds.add(item.productId);
      validInteger(item.quantity, 1, limits.quantity);
    }
  }
});

test("sample catalog clearly discloses fictional prices", () => {
  assert.equal(catalogMetadata.isSample, true);
  assert.match(catalogMetadata.notice, /架空価格/);
});
