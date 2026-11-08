import type { Catalog } from "../domain/optimization";
import snapshot from "./kfc-menu.json" with { type: "json" };

/** Official listing snapshot; configurable bundles are displayed separately. */
export const menuEntries = snapshot.entries;
export const menuCategories = ["おすすめ", "チキン", "セット", "バーガー（推し）", "サイド", "ドリンク", "キッズ"];
export const catalogMetadata = {
  isSample: false,
  sourceUrl: snapshot.sourceUrl,
  fetchedAt: snapshot.fetchedAt,
  notice: snapshot.scope,
  calculationScope: "計算対象は単品30商品のみです。セット・パック36商品は一覧表示のみで、計算には含みません。",
};

// Preserve the numeric portion of official IDs across price/name updates.
const singles = menuEntries.filter(entry => entry.kind === "single");
const idOf = (entry: typeof menuEntries[number]) => Number(entry.officialId.split("-")[1]);
export const catalog: Catalog = {
  products: singles.map(entry => ({ id: idOf(entry), name: entry.name })),
  offers: singles.map(entry => ({
    id: idOf(entry), name: entry.name, priceYen: entry.priceYen,
    items: [{ productId: idOf(entry), quantity: 1 }],
  })),
};
