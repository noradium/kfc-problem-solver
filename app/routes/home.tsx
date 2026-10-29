import { useEffect, useState } from "react";
import { useLoaderData } from "react-router";
import { getProducts } from "../lib/db.server";
export function loader() { return { products: getProducts() }; }
export default function Home() {
  const { products } = useLoaderData<typeof loader>();
  const [status, setStatus] = useState("読み込み中");
  useEffect(() => { let active = true; import("../lib/solver.client").then(m => m.loadSolverVersion()).then(v => { if (active) setStatus(`接続済み (ABI v${v})`); }).catch(() => { if (active) setStatus("読み込み失敗。npm run wasm:build を実行してください"); }); return () => { active = false; }; }, []);
  return <main><h1>KFC の購入プラン</h1><p>開発準備用の画面です。最安値の計算機能は準備中です。</p><p>Rust / WebAssembly: {status}</p><h2>商品</h2>{products.length ? <ul>{products.map(p => <li key={p.id}>{p.name}</li>)}</ul> : <p>商品はまだ登録されていません。</p>}</main>;
}
