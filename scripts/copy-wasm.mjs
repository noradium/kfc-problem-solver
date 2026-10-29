import { copyFileSync, mkdirSync } from "node:fs";
mkdirSync("public/wasm", { recursive: true });
copyFileSync("solver/target/wasm32-unknown-unknown/release/kfc_solver.wasm", "public/wasm/kfc_solver.wasm");
