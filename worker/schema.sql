CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  plan TEXT NOT NULL,
  quoted_usd TEXT NOT NULL,
  payment_amount TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'PENDING',
  tx_id TEXT UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  paid_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_amount ON orders(payment_amount);
