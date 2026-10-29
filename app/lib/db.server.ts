import { DatabaseSync } from "node:sqlite";
import { resolve } from "node:path";
export function getProducts() {
  const db = new DatabaseSync(resolve(process.env.DATABASE_PATH ?? "data/kfc.sqlite"), { readOnly: true });
  try { return db.prepare("SELECT id, name FROM products ORDER BY id").all() as { id: number; name: string }[]; }
  finally { db.close(); }
}
