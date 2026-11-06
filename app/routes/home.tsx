import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { catalog, catalogMetadata } from "../data/catalog";
import { OPTIMIZATION_LIMITS, type OptimizationResult, type PurchasePlan } from "../domain/optimization";
import { startOptimization } from "../lib/solver.client";

const yen = (price: number) => `${price.toLocaleString("ja-JP")} 円`;
const productName = (id: number) => catalog.products.find(p => p.id === id)!.name;
function Plan({ plan }: { plan: PurchasePlan }) {
  return <>
    <p className="price">{yen(plan.totalPriceYen)}</p>
    <h3>購入するもの</h3>
    {plan.purchases.length ? <ul>{plan.purchases.map(line => {
      const offer = catalog.offers.find(o => o.id === line.offerId)!;
      return <li key={line.offerId}>{offer.name} × {line.quantity}<span> — {yen(offer.priceYen * line.quantity)}</span></li>;
    })}</ul> : <p>購入は不要です。</p>}
    <h3>余る商品</h3>
    {plan.surplus.length ? <ul>{plan.surplus.map(item => <li key={item.productId}>{productName(item.productId)} × {item.quantity}</li>)}</ul> : <p>余りはありません。</p>}
  </>;
}
export default function Home() {
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const cancelRef = useRef<(() => void) | null>(null);
  const generation = useRef(0);
  const stop = () => { generation.current++; cancelRef.current?.(); cancelRef.current = null; };
  useEffect(() => () => { generation.current++; cancelRef.current?.(); }, []);
  const invalid = catalog.products.some(p => {
    const value = quantities[p.id] ?? "0";
    return !/^\d+$/.test(value) || !Number.isInteger(Number(value)) || Number(value) > OPTIMIZATION_LIMITS.quantity;
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (invalid) return;
    stop(); setResult(null); setBusy(true);
    const current = generation.current;
    cancelRef.current = startOptimization({ schemaVersion: 1, catalog,
      demand: catalog.products.map(p => ({ productId: p.id, quantity: Number(quantities[p.id] ?? 0) })).filter(i => i.quantity > 0),
    }, next => {
      if (current !== generation.current) return;
      setBusy(false); setResult(next);
    });
  };
  return <main>
    <header><p className="eyebrow">BROWSER OPTIMIZER</p><h1>KFC の購入プラン</h1><p>欲しい個数から、単品とセットのお得な組み合わせを探します。</p></header>
    <aside className="notice">{catalogMetadata.notice}<br/>このサンプルでの計算結果は、実際のお買い物には使えません。</aside>
    <div className="columns">
      <section className="panel"><h2>1. 欲しい個数を入力</h2><p>セットで余りが出ても、希望数以上を満たす最安値を探します。</p>
        <form onSubmit={submit}>
          {catalog.products.map(p => <label className="quantity" key={p.id}><span>{p.name}</span>
            <input aria-label={`${p.name}の個数`} type="number" min="0" max={OPTIMIZATION_LIMITS.quantity} step="1" required inputMode="numeric"
              value={quantities[p.id] ?? "0"} onChange={event => {
                stop(); setBusy(false); setResult(null);
                setQuantities(q => ({ ...q, [p.id]: event.target.value }));
              }}/><span>個</span></label>)}
          {invalid && <p role="alert">個数は 0〜{OPTIMIZATION_LIMITS.quantity} の整数で入力してください。</p>}
          <div className="actions"><button type="submit" disabled={invalid || busy}>{busy ? "計算中…" : "購入プランを計算"}</button>
            {busy && <button className="secondary" type="button" onClick={() => { stop(); setBusy(false); }}>キャンセル</button>}</div>
        </form>
      </section>
      <section className="panel result" aria-live="polite" aria-busy={busy}>
        <h2>2. 購入プラン</h2>
        {busy ? <p role="status">ブラウザで計算しています…</p> : !result ? <p>希望個数を入力して計算してください。</p> : <>
          {result.status === "optimal" && <><p className="badge">このサンプル内の最安値</p><Plan plan={result.plan}/></>}
          {result.status === "infeasible" && <p>このメニューでは希望数を満たせません。</p>}
          {result.status === "time_limit" && <><p>計算の上限に達しました。最安値は確定していません。個数を減らして再試行してください。</p>{result.incumbent && <><h3>暫定プラン</h3><Plan plan={result.incumbent}/></>}</>}
          {(result.status === "invalid_input" || result.status === "error") && <p role="alert">{result.message}</p>}
        </>}
      </section>
    </div>
    <section className="panel"><h2>計算に使うメニュー</h2><ul className="menu">{catalog.offers.map(offer => <li key={offer.id}><h3>{offer.name}</h3><p>{yen(offer.priceYen)}</p><ul>{offer.items.map(i => <li key={i.productId}>{productName(i.productId)} × {i.quantity}</li>)}</ul></li>)}</ul></section>
    <footer>計算はお使いのブラウザ内で行います。同額の場合は余り、購入する販売単位の数が少ない順に選びます。</footer>
  </main>;
}
