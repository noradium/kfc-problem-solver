CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS offers (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  price_yen INTEGER NOT NULL CHECK(price_yen >= 0)
);
CREATE TABLE IF NOT EXISTS offer_items (
  offer_id INTEGER NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL CHECK(quantity > 0),
  PRIMARY KEY (offer_id, product_id)
);
