//! Exact bounded integer covering search. All objectives use integer arithmetic.
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{cell::RefCell, collections::HashSet};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Item {
    product_id: u64,
    quantity: u64,
}
#[derive(Deserialize)]
struct Product {
    id: u64,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Offer {
    id: u64,
    price_yen: u64,
    items: Vec<Item>,
}
#[derive(Deserialize)]
struct Catalog {
    products: Vec<Product>,
    offers: Vec<Offer>,
}
#[derive(Deserialize)]
struct Request {
    catalog: Catalog,
    demand: Vec<Item>,
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct Line {
    offer_id: u64,
    quantity: u64,
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct Surplus {
    product_id: u64,
    quantity: u64,
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct Plan {
    purchases: Vec<Line>,
    total_price_yen: u64,
    surplus: Vec<Surplus>,
    total_surplus_quantity: u64,
    total_offer_quantity: u64,
}
impl Plan {
    fn score(&self) -> (u64, u64, u64) {
        (
            self.total_price_yen,
            self.total_surplus_quantity,
            self.total_offer_quantity,
        )
    }
}
fn array(v: &Value) -> Result<&Vec<Value>, &'static str> {
    v.as_array().ok_or("invalid_structure")
}
fn number(v: &Value, min: u64, max: u64) -> Result<u64, &'static str> {
    if !v.is_number() {
        return Err("invalid_structure");
    }
    let n = v.as_u64().ok_or("invalid_number")?;
    if n < min {
        Err("invalid_number")
    } else if n > max {
        Err("limit_exceeded")
    } else {
        Ok(n)
    }
}
fn validate(v: &Value) -> Result<(), &'static str> {
    if !v["schemaVersion"].is_number() {
        return Err("invalid_structure");
    }
    if v["schemaVersion"].as_u64() != Some(1) {
        return Err("unsupported_schema");
    }
    let products = array(&v["catalog"]["products"])?;
    let offers = array(&v["catalog"]["offers"])?;
    let demand = array(&v["demand"])?;
    if products.len() > 100 || offers.len() > 500 || demand.len() > 100 {
        return Err("limit_exceeded");
    }
    let mut product_ids = HashSet::new();
    for p in products {
        let id = number(&p["id"], 1, 9_007_199_254_740_991)?;
        if !product_ids.insert(id) {
            return Err("duplicate_id");
        }
        if p["name"].as_str().is_none_or(|s| s.trim().is_empty()) {
            return Err("invalid_structure");
        }
    }
    let check_items = |items: &[Value]| -> Result<(), &'static str> {
        let mut ids = HashSet::new();
        for item in items {
            let id = number(&item["productId"], 1, 9_007_199_254_740_991)?;
            if !product_ids.contains(&id) {
                return Err("unknown_product");
            }
            if !ids.insert(id) {
                return Err("duplicate_product");
            }
            number(&item["quantity"], 1, 100)?;
        }
        Ok(())
    };
    let mut offer_ids = HashSet::new();
    for o in offers {
        let id = number(&o["id"], 1, 9_007_199_254_740_991)?;
        if !offer_ids.insert(id) {
            return Err("duplicate_id");
        }
        if o["name"].as_str().is_none_or(|s| s.trim().is_empty()) {
            return Err("invalid_structure");
        }
        number(&o["priceYen"], 0, 1_000_000)?;
        let items = array(&o["items"])?;
        if items.is_empty() {
            return Err("empty_offer");
        }
        check_items(items)?;
    }
    check_items(demand)
}
struct Search {
    products: Vec<u64>,
    offers: Vec<Offer>,
    amounts: Vec<Vec<u64>>,
    demand: Vec<u64>,
    counts: Vec<u64>,
    supplied: Vec<u64>,
    best: Option<Plan>,
    left: u32,
    exhausted: bool,
}
impl Search {
    fn plan(&self, price: u64, units: u64) -> Plan {
        let mut purchases: Vec<_> = self
            .offers
            .iter()
            .zip(&self.counts)
            .filter(|(_, n)| **n > 0)
            .map(|(o, n)| Line {
                offer_id: o.id,
                quantity: *n,
            })
            .collect();
        purchases.sort_by_key(|l| l.offer_id);
        let mut surplus: Vec<_> = self
            .products
            .iter()
            .enumerate()
            .filter_map(|(i, id)| {
                let quantity = self.supplied[i].saturating_sub(self.demand[i]);
                (quantity > 0).then_some(Surplus {
                    product_id: *id,
                    quantity,
                })
            })
            .collect();
        surplus.sort_by_key(|s| s.product_id);
        let total_surplus_quantity = surplus.iter().map(|s| s.quantity).sum();
        Plan {
            purchases,
            total_price_yen: price,
            surplus,
            total_surplus_quantity,
            total_offer_quantity: units,
        }
    }
    fn visit(&mut self, index: usize, price: u64, units: u64) {
        if self.left == 0 {
            self.exhausted = true;
            return;
        }
        self.left -= 1;
        if self.supplied.iter().zip(&self.demand).all(|(s, d)| s >= d) {
            let plan = self.plan(price, units);
            if self.best.as_ref().is_none_or(|b| plan.score() < b.score()) {
                self.best = Some(plan);
            }
            return;
        }
        if index == self.offers.len() {
            return;
        }
        let excess: u64 = self
            .supplied
            .iter()
            .zip(&self.demand)
            .map(|(s, d)| s.saturating_sub(*d))
            .sum();
        if self
            .best
            .as_ref()
            .is_some_and(|b| (price, excess, units) >= b.score())
        {
            return;
        }
        // Every remaining deficit needs at least this much money, even allowing
        // fractional offers. The maximum per-product bound is admissible.
        let mut lower = 0;
        for i in 0..self.products.len() {
            let deficit = self.demand[i].saturating_sub(self.supplied[i]);
            if deficit == 0 {
                continue;
            }
            let cheapest = (index..self.offers.len())
                .filter(|j| self.amounts[*j][i] > 0)
                .min_by(|a, b| {
                    (self.offers[*a].price_yen * self.amounts[*b][i])
                        .cmp(&(self.offers[*b].price_yen * self.amounts[*a][i]))
                });
            let Some(j) = cheapest else {
                return;
            };
            lower = lower.max((deficit * self.offers[j].price_yen).div_ceil(self.amounts[j][i]));
        }
        if self
            .best
            .as_ref()
            .is_some_and(|b| price + lower > b.total_price_yen)
        {
            return;
        }
        // More copies than this cannot help any outstanding demand, and can
        // only worsen the nonnegative lexicographic objective.
        let max = (0..self.products.len())
            .filter(|i| self.amounts[index][*i] > 0)
            .map(|i| {
                self.demand[i]
                    .saturating_sub(self.supplied[i])
                    .div_ceil(self.amounts[index][i])
            })
            .max()
            .unwrap_or(0);
        let offer_price = self.offers[index].price_yen;
        for count in (0..=max).rev() {
            if self.exhausted {
                break;
            }
            if self
                .best
                .as_ref()
                .is_some_and(|b| price + count * offer_price > b.total_price_yen)
            {
                continue;
            }
            self.counts[index] = count;
            for i in 0..self.products.len() {
                self.supplied[i] += self.amounts[index][i] * count;
            }
            self.visit(index + 1, price + count * offer_price, units + count);
            for i in 0..self.products.len() {
                self.supplied[i] -= self.amounts[index][i] * count;
            }
        }
        self.counts[index] = 0;
    }
}
pub fn solve(input: &str, budget: u32) -> Value {
    let v: Value = match serde_json::from_str(input) {
        Ok(v) => v,
        Err(_) => {
            return json!({"status":"invalid_input","code":"invalid_structure","message":"JSON を読み取れません"})
        }
    };
    if let Err(code) = validate(&v) {
        return json!({"status":"invalid_input","code":code,"message":"商品データまたは希望数が入力仕様に合いません"});
    }
    let request: Request = match serde_json::from_value(v) {
        Ok(r) => r,
        Err(_) => {
            return json!({"status":"invalid_input","code":"invalid_structure","message":"入力形式が不正です"})
        }
    };
    let products: Vec<_> = request.catalog.products.iter().map(|p| p.id).collect();
    let demand: Vec<_> = products
        .iter()
        .map(|id| {
            request
                .demand
                .iter()
                .find(|d| d.product_id == *id)
                .map_or(0, |d| d.quantity)
        })
        .collect();
    let mut offers = request.catalog.offers;
    // Good incumbents early; no floating point or reliance on this heuristic for correctness.
    offers.sort_by(|a, b| {
        let aq: u64 = a.items.iter().map(|i| i.quantity).sum();
        let bq: u64 = b.items.iter().map(|i| i.quantity).sum();
        (a.price_yen * bq)
            .cmp(&(b.price_yen * aq))
            .then(a.id.cmp(&b.id))
    });
    let amounts = offers
        .iter()
        .map(|o| {
            products
                .iter()
                .map(|id| {
                    o.items
                        .iter()
                        .find(|i| i.product_id == *id)
                        .map_or(0, |i| i.quantity)
                })
                .collect()
        })
        .collect();
    let mut search = Search {
        counts: vec![0; offers.len()],
        supplied: vec![0; products.len()],
        products,
        offers,
        amounts,
        demand,
        best: None,
        left: budget,
        exhausted: false,
    };
    search.visit(0, 0, 0);
    if search.exhausted {
        json!({"status":"time_limit","incumbent":search.best})
    } else if let Some(plan) = search.best {
        json!({"status":"optimal","plan":plan})
    } else {
        json!({"status":"infeasible"})
    }
}

// Small JSON ABI: input is caller-owned, output lives until the next solve.
thread_local! { static OUTPUT: RefCell<Vec<u8>> = const { RefCell::new(Vec::new()) }; }
#[no_mangle]
pub extern "C" fn solver_version() -> u32 {
    2
}
#[no_mangle]
pub extern "C" fn allocate(len: usize) -> *mut u8 {
    Box::into_raw(vec![0u8; len].into_boxed_slice()) as *mut u8
}
/// # Safety
/// ptr/len must be an allocation returned by allocate and freed only once.
#[no_mangle]
pub unsafe extern "C" fn release(ptr: *mut u8, len: usize) {
    drop(Box::from_raw(std::ptr::slice_from_raw_parts_mut(ptr, len)));
}
/// # Safety
/// ptr/len must reference live initialized bytes in WASM linear memory.
#[no_mangle]
pub unsafe extern "C" fn solve_json(ptr: *const u8, len: usize, budget: u32) {
    let bytes = std::slice::from_raw_parts(ptr, len);
    let result = match std::str::from_utf8(bytes) {
        Ok(s) => solve(s, budget),
        Err(_) => {
            json!({"status":"invalid_input","code":"invalid_structure","message":"UTF-8 が不正です"})
        }
    };
    OUTPUT.with(|o| *o.borrow_mut() = result.to_string().into_bytes());
}
#[no_mangle]
pub extern "C" fn result_ptr() -> *const u8 {
    OUTPUT.with(|o| o.borrow().as_ptr())
}
#[no_mangle]
pub extern "C" fn result_len() -> usize {
    OUTPUT.with(|o| o.borrow().len())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn invalid_json() {
        assert_eq!(solve("{", 100)["code"], "invalid_structure");
    }
    #[test]
    fn version() {
        assert_eq!(solver_version(), 2);
    }
}
