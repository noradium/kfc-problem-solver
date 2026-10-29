import type {
  Catalog,
  OptimizationRequest,
  OptimizationResult,
  PurchasePlan,
} from "../../app/domain/optimization.ts";

// Synthetic prices only. These are not KFC prices or production seed data.
const products = [
  { id: 1, name: "検証用チキン" },
  { id: 2, name: "検証用ポテト" },
  { id: 3, name: "検証用ドリンク" },
];
const singles: Catalog = {
  products,
  offers: [
    { id: 1, name: "単品チキン", priceYen: 300, items: [{ productId: 1, quantity: 1 }] },
    { id: 2, name: "単品ポテト", priceYen: 200, items: [{ productId: 2, quantity: 1 }] },
  ],
};
const set = {
  id: 3, name: "固定セット", priceYen: 650,
  items: [{ productId: 1, quantity: 2 }, { productId: 2, quantity: 1 }],
};
const request = (catalog: Catalog, demand: OptimizationRequest["demand"]): OptimizationRequest =>
  ({ schemaVersion: 1, catalog, demand });
const plan = (
  purchases: PurchasePlan["purchases"], totalPriceYen: number,
  surplus: PurchasePlan["surplus"] = [],
): PurchasePlan => ({
  purchases, totalPriceYen, surplus,
  totalSurplusQuantity: surplus.reduce((n, item) => n + item.quantity, 0),
  totalOfferQuantity: purchases.reduce((n, line) => n + line.quantity, 0),
});

interface OptimizationExample {
  name: string;
  request: OptimizationRequest;
  expected: Extract<OptimizationResult, { status: "optimal" | "infeasible" }>;
}

/** Reusable acceptance examples for the Rust solver and browser integration. */
export const optimizationExamples: OptimizationExample[] = [
  {
    name: "単品だけで希望数を満たす",
    request: request(singles, [{ productId: 1, quantity: 2 }, { productId: 2, quantity: 1 }]),
    expected: { status: "optimal", plan: plan([{ offerId: 1, quantity: 2 }, { offerId: 2, quantity: 1 }], 800) },
  },
  {
    name: "セットが単品より安い",
    request: request({ products, offers: [...singles.offers, set] }, [{ productId: 1, quantity: 2 }, { productId: 2, quantity: 1 }]),
    expected: { status: "optimal", plan: plan([{ offerId: 3, quantity: 1 }], 650) },
  },
  {
    name: "セットと単品を組み合わせる",
    request: request({ products, offers: [...singles.offers, set] }, [{ productId: 1, quantity: 3 }, { productId: 2, quantity: 1 }]),
    expected: { status: "optimal", plan: plan([{ offerId: 1, quantity: 1 }, { offerId: 3, quantity: 1 }], 950) },
  },
  {
    name: "余りを許容すると安くなる",
    request: request({ products, offers: [...singles.offers, { ...set, priceYen: 500 }] }, [{ productId: 1, quantity: 2 }]),
    expected: { status: "optimal", plan: plan([{ offerId: 3, quantity: 1 }], 500, [{ productId: 2, quantity: 1 }]) },
  },
  {
    name: "同額なら購入数より余りの少なさを優先する",
    request: request({ products, offers: [...singles.offers, { ...set, priceYen: 600 }] }, [{ productId: 1, quantity: 2 }]),
    expected: { status: "optimal", plan: plan([{ offerId: 1, quantity: 2 }], 600) },
  },
  {
    name: "同額かつ余りが同じなら販売単位数が少ない方を選ぶ",
    request: request({ products, offers: [...singles.offers, { ...set, priceYen: 800 }] }, [{ productId: 1, quantity: 2 }, { productId: 2, quantity: 1 }]),
    expected: { status: "optimal", plan: plan([{ offerId: 3, quantity: 1 }], 800) },
  },
  {
    name: "販売されていない商品は購入不可",
    request: request(singles, [{ productId: 3, quantity: 1 }]),
    expected: { status: "infeasible" },
  },
  {
    name: "販売単位がなくても入力としては有効",
    request: request({ products, offers: [] }, [{ productId: 1, quantity: 1 }]),
    expected: { status: "infeasible" },
  },
  {
    name: "希望商品が空なら何も購入しない",
    request: request({ products, offers: [...singles.offers, set] }, []),
    expected: { status: "optimal", plan: plan([], 0) },
  },
  {
    name: "無料商品でも必要以上に購入しない",
    request: request({ products, offers: [{ ...singles.offers[0], priceYen: 0 }] }, [{ productId: 1, quantity: 2 }]),
    expected: { status: "optimal", plan: plan([{ offerId: 1, quantity: 2 }], 0) },
  },
  {
    name: "三つの目的が同じならどちらの販売単位でも正解",
    request: request({ products, offers: [singles.offers[0], { ...singles.offers[0], id: 4 }] }, [{ productId: 1, quantity: 1 }]),
    expected: { status: "optimal", plan: plan([{ offerId: 4, quantity: 1 }], 300) },
  },
  {
    name: "空のカタログと空の希望も有効",
    request: request({ products: [], offers: [] }, []),
    expected: { status: "optimal", plan: plan([], 0) },
  },
];
