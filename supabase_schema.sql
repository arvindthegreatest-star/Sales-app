-- ==============================================================================
-- SRI GOVINDA FOOD PRODUCTS - STREAMLINED CORE DATABASE SCHEMA
-- ==============================================================================
-- Core Pillars: Products, Customers (Buyers), Orders, Routes,
-- Inward Inventory, and Samples Tracker.
-- Live stock deduction connected to order fulfillment & sample giveaways.
-- ==============================================================================

-- 1. TABLE DEFINITIONS

-- Delivery Beats / Routes
CREATE TABLE IF NOT EXISTS routes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  short TEXT,
  hub TEXT,
  cutoff TEXT DEFAULT '4:30 PM',
  vehicle TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Customers / Store Directory
CREATE TABLE IF NOT EXISTS buyers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  tier TEXT DEFAULT 'Retail', -- 'HoReCa', 'Wholesale', 'Retail', 'Caterer'
  phone TEXT,
  "homeRoute" TEXT,
  "creditLimit" NUMERIC DEFAULT 0,
  "pendingUdhaar" NUMERIC DEFAULT 0,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Products Master Catalog
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'General',
  "unitSize" TEXT DEFAULT '1kg pack',
  "baseRate" NUMERIC NOT NULL DEFAULT 0,
  "initialStock" NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Commercial Sales Orders (Connected with Live Stock Deduction)
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  "repName" TEXT DEFAULT 'Field Rep',
  "buyerId" TEXT,
  "buyerName" TEXT NOT NULL,
  "buyerPhone" TEXT,
  "dispatchRoute" TEXT,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  items JSONB DEFAULT '[]'::jsonb,
  "totalUnits" NUMERIC DEFAULT 0,
  "itemsSubtotal" NUMERIC DEFAULT 0,
  "extraRebate" NUMERIC DEFAULT 0,
  "netPayable" NUMERIC DEFAULT 0,
  "paymentMode" TEXT DEFAULT 'Cash',
  status TEXT DEFAULT 'Pending Delivery', -- 'Pending Delivery', 'Delivered'
  "deliveredAt" TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Backward-compatibility column migration if table already exists
ALTER TABLE orders ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Pending Delivery';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMPTZ;

-- Inward Inventory (Stock arrivals from factory/suppliers)
CREATE TABLE IF NOT EXISTS inventory_inward (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  product_sku TEXT NOT NULL,
  product_name TEXT,
  unit_size TEXT,
  quantity_units NUMERIC DEFAULT 0,
  batch_number TEXT,
  supplier_or_source TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Samples Tracker (Free giveaways for chef tastings, trials & client acquisition)
CREATE TABLE IF NOT EXISTS sample_giveaways (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  product_sku TEXT NOT NULL,
  product_name TEXT,
  unit_size TEXT,
  quantity_units NUMERIC DEFAULT 0,
  store_name TEXT,
  rep_name TEXT,
  sample_reason TEXT,
  feedback_status TEXT DEFAULT 'Pending Follow-up',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Contract Pricing / Customer-Specific Negotiated Product Rates
CREATE TABLE IF NOT EXISTS contract_pricing (
  id BIGSERIAL PRIMARY KEY,
  "buyerId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "overrideRate" NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE("buyerId", "productId")
);

-- 2. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_inward ENABLE ROW LEVEL SECURITY;
ALTER TABLE sample_giveaways ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_pricing ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public full access routes" ON routes;
CREATE POLICY "Public full access routes" ON routes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access buyers" ON buyers;
CREATE POLICY "Public full access buyers" ON buyers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access products" ON products;
CREATE POLICY "Public full access products" ON products FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access orders" ON orders;
CREATE POLICY "Public full access orders" ON orders FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access inventory_inward" ON inventory_inward FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public full access inventory_inward" ON inventory_inward FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access sample_giveaways" ON sample_giveaways FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public full access sample_giveaways" ON sample_giveaways FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access contract_pricing" ON contract_pricing;
CREATE POLICY "Public full access contract_pricing" ON contract_pricing FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 3. REALTIME REPLICATION (Instant Updates across all devices)
ALTER PUBLICATION supabase_realtime ADD TABLE orders, products, buyers, routes, inventory_inward, sample_giveaways, contract_pricing;

-- ==============================================================================
-- OPTIONAL: RESET DUMMY DATA SCRIPT
-- If you want to purge test records from Supabase, run this in SQL Editor:
-- TRUNCATE orders, buyers, products, routes, inventory_inward, sample_giveaways, contract_pricing CASCADE;
-- ==============================================================================

