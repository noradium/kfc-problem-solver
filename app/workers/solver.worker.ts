import { instantiateSolver } from "../lib/wasm-api";
import type { OptimizationRequest, OptimizationResult } from "../domain/optimization";

self.onmessage = async (event: MessageEvent<OptimizationRequest>) => {
  let result: OptimizationResult;
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}wasm/kfc_solver.wasm`);
    if (!response.ok) throw new Error("WASM の取得に失敗しました");
    const solve = await instantiateSolver(await response.arrayBuffer());
    result = solve(event.data);
  } catch {
    result = { status: "error", message: "計算機能を読み込めませんでした。ページを再読み込みして再試行してください。" };
  }
  self.postMessage(result);
};
