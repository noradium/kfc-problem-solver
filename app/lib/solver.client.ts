import type { OptimizationRequest, OptimizationResult } from "../domain/optimization";

/** Each run owns a Worker, so cancellation also interrupts synchronous WASM. */
export function startOptimization(
  request: OptimizationRequest,
  onResult: (result: OptimizationResult) => void,
): () => void {
  let worker: Worker;
  try { worker = new Worker(new URL("../workers/solver.worker.ts", import.meta.url), { type: "module" }); }
  catch {
    onResult({ status: "error", message: "計算用 Worker を起動できません。対応ブラウザで再試行してください。" });
    return () => {};
  }
  let active = true;
  const cancel = () => {
    active = false;
    clearTimeout(timer);
    worker.terminate();
  };
  const finish = (result: OptimizationResult) => {
    if (!active) return;
    cancel();
    onResult(result);
  };
  // Includes Worker startup and WASM download. No optimality claim on deadline.
  const timer = setTimeout(() => finish({ status: "time_limit", incumbent: null }), 5_000);
  worker.onmessage = (event: MessageEvent<OptimizationResult>) => finish(event.data);
  worker.onerror = () => finish({ status: "error", message: "計算に失敗しました。もう一度お試しください。" });
  worker.onmessageerror = () => finish({ status: "error", message: "計算結果を読み取れませんでした。" });
  try { worker.postMessage(request); }
  catch { finish({ status: "error", message: "計算データを送信できませんでした。" }); }
  return cancel;
}
