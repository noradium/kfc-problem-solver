import type { Catalog } from "../domain/optimization";

/** Demonstration data only; replace with verified menu data before real use.
 * Keep IDs stable when updating prices or display names. */
export const catalogMetadata = {
  isSample: true,
  notice: "表示価格は動作確認用の架空価格です。KFC の実際の販売価格ではありません。",
};

export const catalog: Catalog = {
  products: [
    { id: 1, name: "サンプルチキン" },
    { id: 2, name: "サンプルポテト" },
  ],
  offers: [
    { id: 1, name: "チキン単品（サンプル）", priceYen: 300, items: [{ productId: 1, quantity: 1 }] },
    { id: 2, name: "ポテト単品（サンプル）", priceYen: 200, items: [{ productId: 2, quantity: 1 }] },
    { id: 3, name: "固定セット（サンプル）", priceYen: 650, items: [{ productId: 1, quantity: 2 }, { productId: 2, quantity: 1 }] },
  ],
};
