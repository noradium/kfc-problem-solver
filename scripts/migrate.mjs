import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
export function migrate(path = process.env.DATABASE_PATH ?? "data/kfc.sqlite") {
  const file = resolve(path);
  mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  try {
    db.exec("PRAGMA foreign_keys = ON; BEGIN IMMEDIATE;");
    db.exec(readFileSync(new URL("../db/001_initial.sql", import.meta.url), "utf8"));
    db.exec("COMMIT;");
  } finally { db.close(); }
}
if (process.argv[1] && resolve(process.argv[1]) === new URL(import.meta.url).pathname) migrate();
