export async function loadSolverVersion(): Promise<number> {
  const response = await fetch("/wasm/kfc_solver.wasm");
  if (!response.ok) throw new Error("WASM の読み込みに失敗しました");
  const { instance } = await WebAssembly.instantiate(await response.arrayBuffer());
  return (instance.exports.solver_version as () => number)();
}
