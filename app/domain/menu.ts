import type { Catalog, Offer, Product, ProductQuantity } from "./optimization.ts";
import { OPTIMIZATION_LIMITS } from "./optimization.ts";

export interface ChoiceGroup {
  name: string;
  options: { productId: number; extraPriceYen: number }[];
}
export interface BundleDefinition {
  officialId: string;
  priceYen: number;
  fixedItems: ProductQuantity[];
  groups: { groupId: string; quantity: number; distinct?: boolean }[];
  sources: { sourceUrl: string; fetchedAt?: string; checkedAt?: string; sourceSha256?: string; note?: string }[];
  availableFrom?: string;
  availableUntil?: string;
  notes?: string[];
}
export interface BundleSnapshot {
  schemaVersion: number;
  checkedAt: string;
  components: (Product & { selectable?: boolean })[];
  choiceGroups: Record<string, ChoiceGroup>;
  bundles: BundleDefinition[];
}
export interface MenuOffer extends Offer {
  kind: "single" | "bundle";
  officialId: string;
  basePriceYen: number;
  selections: ProductQuantity[];
  sourceUrl: string;
  availableFrom?: string;
  availableUntil?: string;
}
export interface MenuCatalog extends Catalog { offers: MenuOffer[]; }

export function mergeItems(items: ProductQuantity[]): ProductQuantity[] {
  const quantities = new Map<number, number>();
  for (const item of items) quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
  return [...quantities].sort(([a], [b]) => a - b).map(([productId, quantity]) => ({ productId, quantity }));
}

/** Enumerate unordered selections, including repeated sides and paid upgrades. */
export function expandBundle(
  bundle: BundleDefinition,
  groups: Record<string, ChoiceGroup>,
  name: string,
): MenuOffer[] {
  let variants: { selections: ProductQuantity[]; extra: number }[] = [{ selections: [], extra: 0 }];
  for (const selection of bundle.groups) {
    const group = groups[selection.groupId];
    const choices: typeof variants = [];
    function choose(left: number, start: number, items: ProductQuantity[], extra: number) {
      if (left === 0) { choices.push({ selections: mergeItems(items), extra }); return; }
      for (let i = start; i < group.options.length; i++) {
        const option = group.options[i];
        choose(left - 1, selection.distinct ? i + 1 : i,
          [...items, { productId: option.productId, quantity: 1 }], extra + option.extraPriceYen);
      }
    }
    choose(selection.quantity, 0, [], 0);
    variants = variants.flatMap(variant => choices.map(choice => ({
      selections: mergeItems([...variant.selections, ...choice.selections]), extra: variant.extra + choice.extra,
    })));
  }
  if (variants.length >= 10_000) throw new Error("セットの選択肢が多すぎます");
  return variants.map((variant, index) => ({
    kind: "bundle" as const,
    id: Number(bundle.officialId.split("-")[1]) * 10_000 + index + 1,
    officialId: bundle.officialId, name, basePriceYen: bundle.priceYen,
    priceYen: bundle.priceYen + variant.extra,
    items: mergeItems([...bundle.fixedItems, ...variant.selections]), selections: variant.selections,
    sourceUrl: bundle.sources[0].sourceUrl,
    availableFrom: bundle.availableFrom, availableUntil: bundle.availableUntil,
  }));
}

export function isAvailable(offer: { availableFrom?: string; availableUntil?: string }, date: string) {
  return (!offer.availableFrom || offer.availableFrom <= date) && (!offer.availableUntil || date <= offer.availableUntil);
}

export function japanDate(date = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/** Keep a realizable receipt for every candidate. An offer can be replaced when
 * it covers at least the same demand at a lower price, or at the same price with
 * no more total items. For a feasible plan, surplus = total items - total demand.
 * Thus this pruning preserves all three objectives, including unwanted extras.
 */
export function prepareCatalog(catalog: MenuCatalog, demand: ProductQuantity[], purchaseDate: string): MenuCatalog {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(purchaseDate) || !Number.isFinite(Date.parse(purchaseDate))
    || new Date(purchaseDate).toISOString().slice(0, 10) !== purchaseDate) throw new Error("購入日が不正です");
  const ids = new Set<number>();
  for (const item of demand) {
    if (ids.has(item.productId) || !catalog.products.some(product => product.id === item.productId)
      || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > OPTIMIZATION_LIMITS.quantity) {
      throw new Error("希望個数が不正です");
    }
    ids.add(item.productId);
  }
  const candidates = catalog.offers.filter(offer => isAvailable(offer, purchaseDate)).map(offer => ({
    offer,
    units: offer.items.reduce((sum, item) => sum + item.quantity, 0),
    coverage: demand.map(wanted => Math.min(wanted.quantity, offer.items.find(item => item.productId === wanted.productId)?.quantity ?? 0)),
  })).filter(candidate => candidate.coverage.some(quantity => quantity > 0))
    .sort((a, b) => a.offer.priceYen - b.offer.priceYen || a.units - b.units || a.offer.id - b.offer.id);
  const kept: typeof candidates = [];
  for (const candidate of candidates) {
    if (kept.some(other => (other.offer.priceYen < candidate.offer.priceYen || other.units <= candidate.units)
      && other.coverage.every((quantity, index) => quantity >= candidate.coverage[index]))) continue;
    kept.push(candidate);
  }
  return { products: catalog.products, offers: kept.map(candidate => candidate.offer) };
}
