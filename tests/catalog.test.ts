import { test } from "node:test";
import assert from "node:assert/strict";
import { catalog, catalogMetadata } from "../app/data/catalog.ts";
import { OPTIMIZATION_LIMITS as limits } from "../app/domain/optimization.ts";
import { menuEntries, menuCategories, bundleSnapshot, demandProducts } from "../app/data/catalog.ts";
import snapshot from "../app/data/kfc-menu.json" with { type: "json" };

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

test("official snapshot retains source, prices, categories and unique official IDs", () => {
  assert.equal(snapshot.schemaVersion, 1);
  assert.equal(snapshot.taxIncluded, true);
  assert.match(snapshot.sourceSha256, /^[a-f0-9]{64}$/);
  assert.equal(catalogMetadata.isSample, false);
  assert.equal(catalogMetadata.sourceUrl, "https://www.kfc.co.jp/menu");
  assert.ok(Number.isFinite(Date.parse(catalogMetadata.fetchedAt)));
  assert.match(catalogMetadata.notice, /店舗・受取方法を選択していない/);
  assert.equal(menuEntries.length, 66);
  assert.equal(new Set(menuEntries.map(entry => entry.officialId)).size, 66);
  for (const entry of menuEntries) {
    assert.match(entry.officialId, /^I-\d{9}-007$/);
    assert.ok(entry.name.trim());
    assert.ok(Number.isSafeInteger(entry.priceYen) && entry.priceYen >= 0);
    assert.ok(entry.categories.length > 0);
    assert.equal(new Set(entry.categories).size, entry.categories.length);
    assert.ok(entry.categories.every(category => menuCategories.includes(category)));
    assert.ok(["single", "bundle"].includes(entry.kind));
  }
  assert.equal(menuEntries.find(entry => entry.officialId === "I-000032115-007")?.priceYen, 330);
  assert.equal(menuEntries.find(entry => entry.officialId === "I-000032613-007")?.priceYen, 890);
  assert.deepEqual(menuEntries.find(entry => entry.officialId === "I-000033020-007")?.categories, ["おすすめ", "セット"]);
});

test("all 36 bundles have reviewed configurations, prices and source evidence", () => {
  assert.equal(catalog.products.length, 35);
  assert.equal(demandProducts.length, 34);
  assert.equal(bundleSnapshot.schemaVersion, 1);
  assert.equal(bundleSnapshot.bundles.length, 36);
  assert.equal(new Set(bundleSnapshot.bundles.map(bundle => bundle.officialId)).size, 36);
  for (const bundle of bundleSnapshot.bundles) {
    const entry = menuEntries.find(entry => entry.officialId === bundle.officialId)!;
    assert.equal(entry.kind, "bundle");
    assert.equal(entry.priceYen, bundle.priceYen);
    assert.ok(bundle.sources.length > 0);
    for (const source of bundle.sources) {
      assert.ok(["www.kfc.co.jp", "japan.kfc.co.jp"].includes(new URL(source.sourceUrl).hostname));
      assert.ok(Number.isFinite(Date.parse(source.fetchedAt ?? source.checkedAt!)));
      if (source.sourceSha256) assert.match(source.sourceSha256, /^[a-f0-9]{64}$/);
    }
    for (const item of bundle.fixedItems) {
      assert.ok(catalog.products.some(product => product.id === item.productId));
      assert.ok(Number.isInteger(item.quantity) && item.quantity > 0);
    }
    for (const selection of bundle.groups) {
      const group = bundleSnapshot.choiceGroups[selection.groupId];
      assert.ok(group.options.length > 0);
      assert.ok(Number.isInteger(selection.quantity) && selection.quantity > 0 && selection.quantity <= 4);
      if (selection.distinct) assert.ok(selection.quantity <= group.options.length);
      for (const option of group.options) {
        assert.ok(catalog.products.some(product => product.id === option.productId));
        assert.ok(Number.isInteger(option.extraPriceYen) && option.extraPriceYen >= 0);
      }
    }
    const variants = catalog.offers.filter(offer => offer.officialId === bundle.officialId);
    assert.ok(variants.length > 0);
    assert.equal(Math.min(...variants.map(variant => variant.priceYen)), entry.priceYen);
  }
});

test("single selling units retain official IDs and prices alongside bundles", () => {
  assert.equal(catalog.offers.filter(offer => offer.kind === "single").length, 30);
  for (const entry of menuEntries) {
    if (entry.kind !== "single") continue;
    const id = Number(entry.officialId.split("-")[1]);
    const offer = catalog.offers.find(offer => offer.id === id)!;
    assert.equal(offer.name, entry.name);
    assert.equal(offer.priceYen, entry.priceYen);
    assert.deepEqual(offer.items, [{ productId: id, quantity: 1 }]);
  }
});
