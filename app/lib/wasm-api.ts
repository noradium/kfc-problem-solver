import type { OptimizationRequest, OptimizationResult } from "../domain/optimization";
interface SolverExports {
  memory: WebAssembly.Memory;
  solver_version(): number;
  allocate(length: number): number;
  release(pointer: number, length: number): void;
  solve_json(pointer: number, length: number, budget: number): void;
  result_ptr(): number;
  result_len(): number;
}
export async function instantiateSolver(bytes: BufferSource) {
  const { instance } = await WebAssembly.instantiate(bytes);
  const api = instance.exports as unknown as SolverExports;
  if (api.solver_version() !== 2) throw new Error("WASM のバージョンが一致しません");
  return (request: OptimizationRequest, budget = 200_000): OptimizationResult => {
    const input = new TextEncoder().encode(JSON.stringify(request));
    const pointer = api.allocate(input.length);
    try {
      new Uint8Array(api.memory.buffer, pointer, input.length).set(input);
      api.solve_json(pointer, input.length, budget);
      // Reacquire the buffer after solve: allocating inside Rust may grow memory.
      const output = new Uint8Array(api.memory.buffer, api.result_ptr(), api.result_len());
      return JSON.parse(new TextDecoder().decode(output)) as OptimizationResult;
    } finally { api.release(pointer, input.length); }
  };
}
