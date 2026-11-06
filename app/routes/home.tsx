import { useEffect, useState } from "react";
import { catalog, catalogMetadata } from "../data/catalog";

export default function Home() {
  const [status, setStatus] = useState("読み込み中");
  useEffect(() => {
    let active = true;
    import("../lib/solver.client")
      .then(m => m.loadSolverVersion())
      .then(v => { if (active) setStatus(`接続済み (ABI v${v})`); })
      .catch(() => { if (active) setStatus("読み込み失敗。ページを再読み込みしてください。"); });
    return () => { active = false; };
  }, []);

  return (
    <main>
      <h1>KFC の購入プラン</h1>
      <p>開発準備用の画面です。最安値の計算機能は準備中です。</p>
      <p>{catalogMetadata.notice}</p>
      <p role="status">Rust / WebAssembly: {status}</p>
      <h2>商品</h2>
      <ul>{catalog.products.map(product => <li key={product.id}>{product.name}</li>)}</ul>
      <h2>単品・セット</h2>
      <ul>{catalog.offers.map(offer => (
        <li key={offer.id}>
          {offer.name}：{offer.priceYen.toLocaleString("ja-JP")} 円
          <ul>{offer.items.map(item => (
            <li key={item.productId}>{catalog.products.find(p => p.id === item.productId)!.name} × {item.quantity}</li>
          ))}</ul>
        </li>
      ))}</ul>
    </main>
  );
}
