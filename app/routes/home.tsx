import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { catalog, catalogMetadata, menuEntries, menuCategories } from "../data/catalog";
import { OPTIMIZATION_LIMITS, type OptimizationResult, type PurchasePlan } from "../domain/optimization";
import { startOptimization } from "../lib/solver.client";

const yen = (price: number) => `${price.toLocaleString("ja-JP")} 円`;
const fetchedDate = new Intl.DateTimeFormat("ja-JP", { dateStyle: "long", timeZone: "Asia/Tokyo" })
  .format(new Date(catalogMetadata.fetchedAt));
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
    <header><p className="eyebrow">BROWSER OPTIMIZER</p><h1>KFC の購入プラン</h1><p>公式メニューと税込価格を確認し、欲しい単品の購入金額を計算できます。</p></header>
    <aside className="notice">
      <p>出典：<a href={catalogMetadata.sourceUrl} target="_blank" rel="noreferrer">KFC公式メニュー</a> · <time dateTime={catalogMetadata.fetchedAt}>{fetchedDate}</time>取得（日本時間） · 税込価格</p>
      <p>{catalogMetadata.notice}</p><p>{catalogMetadata.calculationScope}</p>
      <p>セット・パックは内容やサイズ変更で追加料金がかかる場合があります。内訳・選択条件は公式サイトでご確認ください。価格は自動更新しません。</p>
    </aside>
    <div className="columns">
      <section className="panel"><h2>1. 欲しい個数を入力</h2><p>単品の希望数を入力してください。ナゲット5ピースは5個入り1商品、ドリンクは記載サイズ1杯を1個と数えます。</p>
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
          {result.status === "optimal" && <><p className="badge">計算対象の単品内での最安値</p><Plan plan={result.plan}/></>}
          {result.status === "infeasible" && <p>このメニューでは希望数を満たせません。</p>}
          {result.status === "time_limit" && <><p>計算の上限に達しました。最安値は確定していません。個数を減らして再試行してください。</p>{result.incumbent && <><h3>暫定プラン</h3><Plan plan={result.incumbent}/></>}</>}
          {(result.status === "invalid_input" || result.status === "error") && <p role="alert">{result.message}</p>}
        </>}
      </section>
    </div>
    <section className="panel official-menu"><h2>公式メニュー（{menuEntries.length}商品）</h2>
      <nav className="categories" aria-label="メニューのカテゴリ">{menuCategories.map((category, index) =>
        <a href={`#category-${index}`} key={category}>{category}</a>)}</nav>
      {menuCategories.map((category, index) => <section key={category} aria-labelledby={`category-${index}`}>
        <h3 id={`category-${index}`}>{category}</h3>
        <table><caption className="visually-hidden">{category}の商品と税込価格</caption>
          <thead><tr><th scope="col">商品</th><th scope="col">税込価格</th></tr></thead>
          <tbody>{menuEntries.filter(entry => entry.categories.includes(category)).map(entry => <tr key={entry.officialId}>
            <td>{entry.name}{entry.kind === "bundle" && <small>セット・パック（一覧表示のみ）</small>}</td>
            <td>{yen(entry.priceYen)}</td>
          </tr>)}</tbody>
        </table>
      </section>)}
    </section>
    <footer>計算はお使いのブラウザ内で行います。同額の場合は余り、購入する販売単位の数が少ない順に選びます。</footer>
  </main>;
}
