import Database from 'better-sqlite3'
import path from 'path'

let _db: Database.Database | null = null

export function getDb(): Database.Database {
  if (_db) return _db

  const dbPath = process.env.DATABASE_PATH ?? path.join(process.cwd(), 'data.db')
  _db = new Database(dbPath)
  _db.pragma('journal_mode = WAL')
  _db.pragma('foreign_keys = ON')

  _db.exec(`
    CREATE TABLE IF NOT EXISTS product_groups (
      id TEXT NOT NULL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      reference_price REAL,
      alert_threshold_pct REAL NOT NULL DEFAULT 5.0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tracked_items (
      id TEXT NOT NULL PRIMARY KEY,
      meli_item_id TEXT NOT NULL UNIQUE,
      product_group_id TEXT REFERENCES product_groups(id) ON DELETE CASCADE,
      seller_nickname TEXT,
      seller_meli_id INTEGER,
      title TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS price_history (
      id TEXT NOT NULL PRIMARY KEY,
      tracked_item_id TEXT NOT NULL REFERENCES tracked_items(id) ON DELETE CASCADE,
      price REAL NOT NULL,
      original_price REAL,
      currency TEXT NOT NULL DEFAULT 'ARS',
      available_quantity INTEGER,
      condition TEXT,
      snapshot_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_ph_item   ON price_history(tracked_item_id);
    CREATE INDEX IF NOT EXISTS idx_ph_time   ON price_history(snapshot_at DESC);
    CREATE INDEX IF NOT EXISTS idx_ti_group  ON tracked_items(product_group_id);
  `)

  return _db
}

export function newId(): string {
  return crypto.randomUUID()
}
