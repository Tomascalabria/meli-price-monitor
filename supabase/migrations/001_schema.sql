-- Product groups: a "product" sold by multiple sellers
CREATE TABLE product_groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  reference_price DECIMAL(12,2),
  alert_threshold_pct DECIMAL(5,2) NOT NULL DEFAULT 5.0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Individual MercadoLibre listings being tracked
CREATE TABLE tracked_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  meli_item_id TEXT NOT NULL UNIQUE,
  product_group_id UUID REFERENCES product_groups(id) ON DELETE CASCADE,
  seller_nickname TEXT,
  seller_meli_id BIGINT,
  title TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Price snapshots taken each time the scraper runs
CREATE TABLE price_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tracked_item_id UUID NOT NULL REFERENCES tracked_items(id) ON DELETE CASCADE,
  price DECIMAL(12,2) NOT NULL,
  original_price DECIMAL(12,2),
  currency TEXT NOT NULL DEFAULT 'ARS',
  available_quantity INT,
  condition TEXT,
  snapshot_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX idx_price_history_item_id ON price_history(tracked_item_id);
CREATE INDEX idx_price_history_snapshot_at ON price_history(snapshot_at DESC);
CREATE INDEX idx_tracked_items_group ON tracked_items(product_group_id);
CREATE INDEX idx_tracked_items_active ON tracked_items(is_active) WHERE is_active = TRUE;

-- View: latest price per tracked item
CREATE VIEW latest_prices AS
SELECT DISTINCT ON (tracked_item_id)
  ph.tracked_item_id,
  ph.price,
  ph.original_price,
  ph.currency,
  ph.available_quantity,
  ph.snapshot_at
FROM price_history ph
ORDER BY tracked_item_id, snapshot_at DESC;

-- View: second-to-last price for calculating change
CREATE VIEW previous_prices AS
SELECT tracked_item_id, price, snapshot_at
FROM (
  SELECT
    tracked_item_id,
    price,
    snapshot_at,
    ROW_NUMBER() OVER (PARTITION BY tracked_item_id ORDER BY snapshot_at DESC) AS rn
  FROM price_history
) ranked
WHERE rn = 2;

-- Enable Row Level Security (open for now — add auth later)
ALTER TABLE product_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracked_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;

-- Permissive policies (replace with auth-based policies when needed)
CREATE POLICY "allow_all_product_groups" ON product_groups FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_tracked_items" ON tracked_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_price_history" ON price_history FOR ALL USING (true) WITH CHECK (true);
