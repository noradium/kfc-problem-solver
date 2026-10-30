/** JSON contract shared by the catalog, UI and future Rust/WASM solver.
 * Numbers must satisfy docs/optimization.md; TypeScript types do not validate JSON.
 */
export const OPTIMIZATION_SCHEMA_VERSION = 1 as const;
export const OPTIMIZATION_LIMITS = {
  products: 100,
  offers: 500,
  quantity: 100,
  priceYen: 1_000_000,
} as const;

/** Positive safe integer matching the SQLite primary key. */
export type ProductId = number;
export type OfferId = number;

export interface Product {
  id: ProductId;
  name: string;
}

export interface ProductQuantity {
  productId: ProductId;
  quantity: number;
}

/** A fixed purchasable unit: either a single item or a fixed-content set. */
export interface Offer {
  id: OfferId;
  name: string;
  priceYen: number;
  items: ProductQuantity[];
}

/** One store/time snapshot. Prices are tax-inclusive integer yen. */
export interface Catalog {
  products: Product[];
  offers: Offer[];
}

export interface OptimizationRequest {
  schemaVersion: typeof OPTIMIZATION_SCHEMA_VERSION;
  catalog: Catalog;
  /** Omit zero quantities. An empty list requests the empty plan. */
  demand: ProductQuantity[];
}

export interface PurchaseLine {
  offerId: OfferId;
  quantity: number;
}

export interface PurchasePlan {
  /** Positive quantities, unique offer IDs, sorted by offer ID ascending. */
  purchases: PurchaseLine[];
  totalPriceYen: number;
  /** Purchased minus requested, including products that were not requested.
   * Omit zero quantities; sorted by product ID ascending. */
  surplus: ProductQuantity[];
  totalSurplusQuantity: number;
  totalOfferQuantity: number;
}

export type InvalidInputCode =
  | "unsupported_schema"
  | "invalid_structure"
  | "invalid_number"
  | "limit_exceeded"
  | "duplicate_id"
  | "duplicate_product"
  | "unknown_product"
  | "empty_offer";

export type OptimizationResult =
  | { status: "optimal"; plan: PurchasePlan }
  | { status: "infeasible" }
  /** A feasible incumbent is optional and is never claimed to be optimal. */
  | { status: "time_limit"; incumbent: PurchasePlan | null }
  | { status: "invalid_input"; code: InvalidInputCode; message: string }
  | { status: "error"; message: string };
