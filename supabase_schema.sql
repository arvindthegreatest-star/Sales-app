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
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "repId" TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "repName" TEXT DEFAULT 'Field Sales';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "buyerAddress" TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "buyerGstin" TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "salespersonId" TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "salespersonName" TEXT;

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

-- Outward Inventory / Dispatch to Sales Personnel (Van / Bag stock issue)
CREATE TABLE IF NOT EXISTS inventory_outward (
  id TEXT PRIMARY KEY,
  voucher_no TEXT,
  date TEXT NOT NULL,
  rep_id TEXT NOT NULL,
  rep_name TEXT NOT NULL,
  items JSONB DEFAULT '[]'::jsonb,
  total_units NUMERIC DEFAULT 0,
  total_value NUMERIC DEFAULT 0,
  vehicle TEXT,
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

-- Sales Personnel Accounts Roster
CREATE TABLE IF NOT EXISTS salespeople (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  "assignedRoute" TEXT,
  "monthlyTarget" NUMERIC DEFAULT 150000,
  "commissionPct" NUMERIC DEFAULT 2.5,
  "vehicleType" TEXT DEFAULT 'Two-Wheeler',
  "dailyOrderTarget" NUMERIC DEFAULT 5,
  "joiningDate" TEXT,
  address TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Backward-compatibility column migrations for salespeople if table already exists
ALTER TABLE salespeople ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE salespeople ADD COLUMN IF NOT EXISTS "commissionPct" NUMERIC DEFAULT 2.5;
ALTER TABLE salespeople ADD COLUMN IF NOT EXISTS "vehicleType" TEXT DEFAULT 'Two-Wheeler';
ALTER TABLE salespeople ADD COLUMN IF NOT EXISTS "dailyOrderTarget" NUMERIC DEFAULT 5;
ALTER TABLE salespeople ADD COLUMN IF NOT EXISTS "joiningDate" TEXT;
ALTER TABLE salespeople ADD COLUMN IF NOT EXISTS address TEXT;

-- 2. ROW LEVEL SECURITY (RLS) POLICIES - STRICT ZERO-TRUST LOCKDOWN
-- The public anon key (embedded in sales portals) is granted STRICTLY READ-ONLY (SELECT) access.
-- All database modifications (orders, samples, stores, products, inward stock) MUST be routed
-- through the secure Edge Function (/functions/v1/sync-order) which authenticates signatures
-- and uses the service_role secret. Direct client writes from anon are 100% BLOCKED.

ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_inward ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_outward ENABLE ROW LEVEL SECURITY;
ALTER TABLE sample_giveaways ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE salespeople ENABLE ROW LEVEL SECURITY;

-- Clean up any legacy permissive policies
DROP POLICY IF EXISTS "Public full access routes" ON routes;
DROP POLICY IF EXISTS "Public read routes" ON routes;
DROP POLICY IF EXISTS "Public full access buyers" ON buyers;
DROP POLICY IF EXISTS "Public read buyers" ON buyers;
DROP POLICY IF EXISTS "Public insert buyers" ON buyers;
DROP POLICY IF EXISTS "Public update buyers" ON buyers;
DROP POLICY IF EXISTS "Public full access products" ON products;
DROP POLICY IF EXISTS "Public read products" ON products;
DROP POLICY IF EXISTS "Public full access orders" ON orders;
DROP POLICY IF EXISTS "Public read orders" ON orders;
DROP POLICY IF EXISTS "Public insert orders" ON orders;
DROP POLICY IF EXISTS "Public full access inventory_inward" ON inventory_inward;
DROP POLICY IF EXISTS "Public read inventory_inward" ON inventory_inward;
DROP POLICY IF EXISTS "Public full access inventory_outward" ON inventory_outward;
DROP POLICY IF EXISTS "Public read inventory_outward" ON inventory_outward;
DROP POLICY IF EXISTS "Public insert inventory_outward" ON inventory_outward;
DROP POLICY IF EXISTS "Public full access sample_giveaways" ON sample_giveaways;
DROP POLICY IF EXISTS "Public read sample_giveaways" ON sample_giveaways;
DROP POLICY IF EXISTS "Public insert sample_giveaways" ON sample_giveaways;
DROP POLICY IF EXISTS "Public full access contract_pricing" ON contract_pricing;
DROP POLICY IF EXISTS "Public read contract_pricing" ON contract_pricing;
DROP POLICY IF EXISTS "Public full access salespeople" ON salespeople;
DROP POLICY IF EXISTS "Public read salespeople" ON salespeople;
DROP POLICY IF EXISTS "Public full access reps" ON reps;

-- Strictly Read-Only (SELECT) Policies for anon and authenticated clients
CREATE POLICY "Public read-only routes" ON routes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read-only buyers" ON buyers FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read-only products" ON products FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read-only orders" ON orders FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read-only inventory_inward" ON inventory_inward FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read-only inventory_outward" ON inventory_outward FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read-only sample_giveaways" ON sample_giveaways FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read-only contract_pricing" ON contract_pricing FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read-only salespeople" ON salespeople FOR SELECT TO anon, authenticated USING (true);

-- 3. REALTIME REPLICATION (Instant Updates across all devices)
ALTER PUBLICATION supabase_realtime ADD TABLE orders, products, buyers, routes, inventory_inward, inventory_outward, sample_giveaways, contract_pricing, salespeople;

-- ==============================================================================
-- OPTIONAL: RESET DUMMY DATA SCRIPT
-- If you want to purge test records from Supabase, run this in SQL Editor:
-- TRUNCATE orders, buyers, products, routes, inventory_inward, sample_giveaways, contract_pricing, salespeople CASCADE;
-- ==============================================================================


