import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { migrate } from "./migrate.mjs";
test("migration is repeatable and catalog constraints hold", () => {
  const dir = mkdtempSync(join(tmpdir(), "kfc-db-"));
  let db;
  try {
    const path = join(dir, "test.sqlite"); migrate(path); migrate(path);
    db = new DatabaseSync(path); db.exec("PRAGMA foreign_keys=ON");
    db.exec("INSERT INTO products VALUES (1, 'テスト商品'); INSERT INTO offers VALUES (1, 'テストセット', 500); INSERT INTO offer_items VALUES (1, 1, 2)");
    assert.equal(db.prepare("SELECT quantity FROM offer_items").get().quantity, 2);
    assert.throws(() => db.exec("INSERT INTO offers VALUES (2, 'invalid', -1)"));
    assert.throws(() => db.exec("INSERT INTO offer_items VALUES (1, 99, 1)"));
  } finally { db?.close(); rmSync(dir, { recursive: true, force: true }); }
});
