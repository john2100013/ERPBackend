-- Basic tables for bar/restaurant module

CREATE TABLE IF NOT EXISTS restaurant_spaces (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  code TEXT,
  show_unrestricted_items BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_restaurant_spaces_business_id
  ON restaurant_spaces (business_id);

CREATE TABLE IF NOT EXISTS restaurant_tables (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  space_id INTEGER NOT NULL REFERENCES restaurant_spaces(id) ON DELETE CASCADE,
  table_no TEXT NOT NULL,
  size INTEGER DEFAULT 4,
  shape TEXT DEFAULT 'rectangle',
  label TEXT,
  status TEXT DEFAULT 'free',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_restaurant_tables_business_space
  ON restaurant_tables (business_id, space_id);

CREATE TABLE IF NOT EXISTS restaurant_orders (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  table_id INTEGER NOT NULL REFERENCES restaurant_tables(id) ON DELETE CASCADE,
  invoice_id INTEGER,
  status TEXT NOT NULL DEFAULT 'open', -- open | sent | billed | closed
  note TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_restaurant_orders_business_status
  ON restaurant_orders (business_id, status);

CREATE TABLE IF NOT EXISTS restaurant_order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES restaurant_orders(id) ON DELETE CASCADE,
  item_id INTEGER NOT NULL REFERENCES items(id),
  quantity NUMERIC(12,2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  description TEXT,
  code TEXT,
  uom TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_restaurant_order_items_order
  ON restaurant_order_items (order_id);


