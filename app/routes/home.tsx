import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { catalog, catalogMetadata, menuEntries, menuCategories, demandProducts, bundleSnapshot } from "../data/catalog";
import { OPTIMIZATION_LIMITS, type OptimizationResult, type PurchasePlan } from "../domain/optimization";
import { prepareCatalog, japanDate, isAvailable, type MenuCatalog } from "../domain/menu";
import { startOptimization } from "../lib/solver.client";

const yen = (price: number) => `${price.toLocaleString("ja-JP")} 円`;
const fetchedDate = new Intl.DateTimeFormat("ja-JP", { dateStyle: "long", timeZone: "Asia/Tokyo" })
  .format(new Date(catalogMetadata.fetchedAt));
const productName = (id: number) => catalog.products.find(p => p.id === id)!.name;
function Plan({ plan, purchaseCatalog }: { plan: PurchasePlan; purchaseCatalog: MenuCatalog }) {
  return <>
    <p className="price">{yen(plan.totalPriceYen)}</p>
    <h3>購入するもの</h3>
    {plan.purchases.length ? <ul>{plan.purchases.map(line => {
      const offer = purchaseCatalog.offers.find(o => o.id === line.offerId)!;
      return <li key={line.offerId}>
        <strong>{offer.name} × {line.quantity}</strong><span> — {yen(offer.priceYen * line.quantity)}</span>
        {offer.selections.length > 0 && <p className="receipt-price">1セット：基本 {yen(offer.basePriceYen)} ＋ 変更料金 {yen(offer.priceYen - offer.basePriceYen)} ＝ {yen(offer.priceYen)}</p>}
        {offer.kind === "bundle" && <><p className="receipt-label">1セットの内容</p>
          <ul>{offer.items.map(item => <li key={item.productId}>{productName(item.productId)} × {item.quantity}</li>)}</ul>
          <a href={offer.sourceUrl} target="_blank" rel="noreferrer">公式の内容・条件</a></>}
      </li>;
    })}</ul> : <p>購入は不要です。</p>}
    <h3>余る商品</h3>
    {plan.surplus.length ? <ul>{plan.surplus.map(item => <li key={item.productId}>{productName(item.productId)} × {item.quantity}</li>)}</ul> : <p>余りはありません。</p>}
  </>;
}
export default function Home() {
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [purchaseDate, setPurchaseDate] = useState(catalogMetadata.checkedDate);
  const [purchaseCatalog, setPurchaseCatalog] = useState<MenuCatalog>(catalog);
  const cancelRef = useRef<(() => void) | null>(null);
  const generation = useRef(0);
  const stop = () => { generation.current++; cancelRef.current?.(); cancelRef.current = null; };
  useEffect(() => () => { generation.current++; cancelRef.current?.(); }, []);
  useEffect(() => { setPurchaseDate(japanDate()); }, []);
  const invalidQuantities = demandProducts.some(p => {
    const value = quantities[p.id] ?? "0";
    return !/^\d+$/.test(value) || !Number.isInteger(Number(value)) || Number(value) > OPTIMIZATION_LIMITS.quantity;
  });
  const invalid = !purchaseDate || invalidQuantities;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (invalid) return;
    stop(); setResult(null); setBusy(true);
    const demand = demandProducts.map(p => ({ productId: p.id, quantity: Number(quantities[p.id] ?? 0) })).filter(i => i.quantity > 0);
    let prepared: MenuCatalog;
    try { prepared = prepareCatalog(catalog, demand, purchaseDate); }
    catch { setBusy(false); setResult({ status: "error", message: "購入日と希望個数を確認してください。" }); return; }
    setPurchaseCatalog(prepared);
    const current = generation.current;
    cancelRef.current = startOptimization({ schemaVersion: 1, catalog: prepared,
      demand,
    }, next => {
      if (current !== generation.current) return;
      setBusy(false); setResult(next);
    });
  };
  return <main>
    <header><p className="eyebrow">BROWSER OPTIMIZER</p><h1>KFC の購入プラン</h1><p>単品・セット・パックを組み合わせて、欲しい商品をそろえる購入プランを比較します。</p></header>
    <aside className="notice">
      <p>出典：<a href={catalogMetadata.sourceUrl} target="_blank" rel="noreferrer">KFC公式メニュー</a> · <time dateTime={catalogMetadata.fetchedAt}>{fetchedDate}</time>取得（日本時間） · 税込価格</p>
      <p>{catalogMetadata.notice}</p><p>{catalogMetadata.calculationScope}</p>
      <p>セットの条件確認：<time dateTime={catalogMetadata.bundlesCheckedAt}>{new Intl.DateTimeFormat("ja-JP", { dateStyle: "long", timeZone: "Asia/Tokyo" }).format(new Date(catalogMetadata.bundlesCheckedAt))}</time>。価格は自動更新しません。クーポン・ランチ価格・同時購入限定の追加割引は対象外です。</p>
    </aside>
    <div className="columns">
      <section className="panel"><h2>1. 欲しい個数を入力</h2><p>希望数以上を満たす組み合わせを探します。ナゲットやディップチキンは商品名に記載の個数で1商品、ドリンクは記載サイズ1杯を1個と数えます。</p>
        <form onSubmit={submit}>
          <label className="purchase-date">購入日（日本時間）<input type="date" required value={purchaseDate} onChange={event => {
            stop(); setBusy(false); setResult(null); setPurchaseDate(event.target.value);
          }}/></label>
          <p>販売期間が確認できた商品は、購入日に合わせて計算対象を切り替えます。</p>
          {demandProducts.map(p => <label className="quantity" key={p.id}><span>{p.name}</span>
            <input aria-label={`${p.name}の個数`} type="number" min="0" max={OPTIMIZATION_LIMITS.quantity} step="1" required inputMode="numeric"
              value={quantities[p.id] ?? "0"} onChange={event => {
                stop(); setBusy(false); setResult(null);
                setQuantities(q => ({ ...q, [p.id]: event.target.value }));
              }}/><span>個</span></label>)}
          {!purchaseDate && <p role="alert">購入日を入力してください。</p>}
          {invalidQuantities && <p role="alert">個数は 0〜{OPTIMIZATION_LIMITS.quantity} の整数で入力してください。</p>}
          <div className="actions"><button type="submit" disabled={invalid || busy}>{busy ? "計算中…" : "購入プランを計算"}</button>
            {busy && <button className="secondary" type="button" onClick={() => { stop(); setBusy(false); }}>キャンセル</button>}</div>
        </form>
      </section>
      <section className="panel result" aria-live="polite" aria-busy={busy}>
        <h2>2. 購入プラン</h2>
        {busy ? <p role="status">ブラウザで計算しています…</p> : !result ? <p>希望個数を入力して計算してください。</p> : <>
          {result.status === "optimal" && <><p className="badge">取り込んだメニュー内での最安値</p><Plan plan={result.plan} purchaseCatalog={purchaseCatalog}/></>}
          {result.status === "infeasible" && <p>このメニューでは希望数を満たせません。</p>}
          {result.status === "time_limit" && <><p>計算の上限に達しました。最安値は確定していません。個数を減らして再試行してください。</p>{result.incumbent && <><h3>暫定プラン</h3><Plan plan={result.incumbent} purchaseCatalog={purchaseCatalog}/></>}</>}
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
          <tbody>{menuEntries.filter(entry => entry.categories.includes(category)).map(entry => {
            const bundle = bundleSnapshot.bundles.find(bundle => bundle.officialId === entry.officialId);
            return <tr key={entry.officialId}>
            <td>{entry.name}{bundle && <>
              <small>{isAvailable(bundle, purchaseDate) ? "セット・パック（計算対象）" : "購入日は販売期間外"}</small>
              <details><summary>内容・選択肢</summary>
                <ul>{bundle.fixedItems.map(item => <li key={item.productId}>{productName(item.productId)} × {item.quantity}</li>)}
                  {bundle.groups.map(selection => <li key={selection.groupId}>
                    {bundleSnapshot.choiceGroups[selection.groupId].name}：{selection.quantity}個選択{selection.distinct ? "（各種類1個）" : ""}
                    <ul>{bundleSnapshot.choiceGroups[selection.groupId].options.map(option => <li key={option.productId}>
                      {productName(option.productId)}{option.extraPriceYen > 0 && `（1個につき＋${yen(option.extraPriceYen)}）`}
                    </li>)}</ul>
                  </li>)}
                </ul>
                {bundle.availableUntil && <p>販売期間：{bundle.availableFrom} 〜 {bundle.availableUntil}</p>}
                {bundle.notes?.map(note => <p key={note}>{note}</p>)}
                <a href={bundle.sources[0].sourceUrl} target="_blank" rel="noreferrer">公式の内容・条件</a>
              </details>
            </>}</td>
            <td>{yen(entry.priceYen)}</td>
          </tr>; })}</tbody>
        </table>
      </section>)}
    </section>
    <footer>計算はお使いのブラウザ内で行います。同額の場合は余り、購入する販売単位の数が少ない順に選びます。</footer>
  </main>;
}
