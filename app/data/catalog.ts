import type { BundleSnapshot, MenuCatalog } from "../domain/menu.ts";
import { expandBundle, japanDate } from "../domain/menu.ts";
import snapshot from "./kfc-menu.json" with { type: "json" };
import bundleData from "./kfc-bundles.json" with { type: "json" };

/** Reviewed official listing and bundle configurations. */
export const menuEntries = snapshot.entries;
export const menuCategories = ["おすすめ", "チキン", "セット", "バーガー（推し）", "サイド", "ドリンク", "キッズ"];
export const bundleSnapshot: BundleSnapshot = bundleData;
export const catalogMetadata = {
  isSample: false,
  sourceUrl: snapshot.sourceUrl,
  fetchedAt: snapshot.fetchedAt,
  notice: snapshot.scope,
  bundlesCheckedAt: bundleData.checkedAt,
  checkedDate: japanDate(new Date(bundleData.checkedAt)),
  calculationScope: "単品30商品とセット・パック36商品の確認済みの構成を比較します。サイド・ドリンクの選択と追加料金も計算します。",
};

// Preserve the numeric portion of official IDs across price/name updates.
const singles = menuEntries.filter(entry => entry.kind === "single");
const idOf = (entry: typeof menuEntries[number]) => Number(entry.officialId.split("-")[1]);
export const catalog: MenuCatalog = {
  products: [...singles.map(entry => ({ id: idOf(entry), name: entry.name })),
    ...bundleData.components.map(component => ({ id: component.id, name: component.name }))],
  offers: [...singles.map(entry => ({
    kind: "single" as const,
    id: idOf(entry), name: entry.name, priceYen: entry.priceYen,
    items: [{ productId: idOf(entry), quantity: 1 }],
    officialId: entry.officialId, basePriceYen: entry.priceYen, selections: [], sourceUrl: snapshot.sourceUrl,
  })), ...bundleSnapshot.bundles.flatMap(bundle => expandBundle(bundle, bundleSnapshot.choiceGroups,
    menuEntries.find(entry => entry.officialId === bundle.officialId)!.name))],
};

export const demandProducts = catalog.products.filter(product =>
  !bundleData.components.some(component => component.id === product.id && component.selectable === false));
