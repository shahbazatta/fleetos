-- ============================================================
--  CloudNext Fleet Management System
--  Schema Update Script — Routes, QR Codes, Mobile Credentials
--
--  Run AFTER: fleet_complete.sql + add_multitenancy.sql
--
--  Usage:
--    psql -U postgres -d fleet_db -f scripts/05_schema_update.sql
--
--  What this script does:
--    1.  Adds extra columns to existing tables (fleet_complete.sql gaps)
--    2.  Creates the `routes` table with PostGIS LineString path
--    3.  Adds `route_id` FK to vehicles
--    4.  Adds `qr_code` column to vehicles (auto-populated)
--    5.  Adds `user_id` FK to drivers (mobile app credentials link)
--    6.  Creates `dispatch_approvals` table
--    7.  Updates the `update_updated_at` trigger function
--    8.  Adds triggers for new tables
--    9.  Refreshes spatial views to include routes
--    10. Adds missing indexes for performance
--
--  All statements use IF NOT EXISTS / IF EXISTS — safe to re-run.
-- ============================================================

\set ON_ERROR_STOP on

DO $$ BEGIN RAISE NOTICE '======================================================'; END $$;
DO $$ BEGIN RAISE NOTICE '  CloudNext Fleet — Schema Update (Routes + QR + Mobile)'; END $$;
DO $$ BEGIN RAISE NOTICE '======================================================'; END $$;


-- ══════════════════════════════════════════════════════════════
-- STEP 1 — Ensure required extensions
-- ══════════════════════════════════════════════════════════════

DO $$ BEGIN RAISE NOTICE '[1] Ensuring extensions...'; END $$;

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN RAISE NOTICE '    [OK] extensions'; END $$;


-- ══════════════════════════════════════════════════════════════
-- STEP 2 — Patch columns missing from original schema.sql
--           but present in fleet_complete.sql / fmStore types
-- ══════════════════════════════════════════════════════════════

DO $$ BEGIN RAISE NOTICE '[2] Patching missing columns on existing tables...'; END $$;

-- users: extra columns added in fleet_complete.sql
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS avatar_url  TEXT,
  ADD COLUMN IF NOT EXISTS phone       VARCHAR(50),
  ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ DEFAULT NOW();

-- depots: city / country / manager / phone
ALTER TABLE depots
  ADD COLUMN IF NOT EXISTS city        VARCHAR(100) DEFAULT 'Lahore',
  ADD COLUMN IF NOT EXISTS country     VARCHAR(100) DEFAULT 'Pakistan',
  ADD COLUMN IF NOT EXISTS manager     VARCHAR(255),
  ADD COLUMN IF NOT EXISTS phone       VARCHAR(50);

-- drivers: extra columns
ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS license_class      VARCHAR(20) DEFAULT 'LTV',
  ADD COLUMN IF NOT EXISTS total_distance_km  NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_hours        NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS emergency_contact  VARCHAR(100),
  ADD COLUMN IF NOT EXISTS photo_url          TEXT;

-- vehicles: extra columns used by the Fleet Management UI
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS fuel_type           VARCHAR(30) DEFAULT 'diesel',
  ADD COLUMN IF NOT EXISTS seats               INTEGER,
  ADD COLUMN IF NOT EXISTS insurance_expiry    DATE,
  ADD COLUMN IF NOT EXISTS registration_expiry DATE,
  ADD COLUMN IF NOT EXISTS purchase_date       DATE,
  ADD COLUMN IF NOT EXISTS notes               TEXT;

-- geofences: zone_type column (used by the frontend)
ALTER TABLE geofences
  ADD COLUMN IF NOT EXISTS zone_type   VARCHAR(50) DEFAULT 'delivery';
-- Allowed values: delivery | restricted | depot | customer | route | other

-- alerts: title column (fleet_complete.sql has it; schema.sql may not)
ALTER TABLE alerts
  ADD COLUMN IF NOT EXISTS title  VARCHAR(255);

DO $$ BEGIN RAISE NOTICE '    [OK] column patches applied'; END $$;


-- ══════════════════════════════════════════════════════════════
-- STEP 3 — ROUTES table
-- ══════════════════════════════════════════════════════════════

DO $$ BEGIN RAISE NOTICE '[3] Creating routes table...'; END $$;

CREATE TABLE IF NOT EXISTS routes (
  id           UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name         VARCHAR(255) NOT NULL,
  description  TEXT,
  color        VARCHAR(20)  NOT NULL DEFAULT '#00d4e8',
  path         GEOMETRY(LineString, 4326) NOT NULL,   -- PostGIS WGS84 LineString
  is_active    BOOLEAN      NOT NULL DEFAULT true,
  distance_km  NUMERIC(10,2),                          -- optional manual override
  duration_min INTEGER,                                -- estimated minutes
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  routes      IS 'Bus / vehicle routes stored as PostGIS LineStrings';
COMMENT ON COLUMN routes.path IS 'WGS84 LineString — coordinates in (lng, lat) order';

CREATE INDEX IF NOT EXISTS idx_routes_tenant  ON routes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_routes_active  ON routes(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_routes_path    ON routes USING GIST(path);

DO $$ BEGIN RAISE NOTICE '    [OK] routes table'; END $$;


-- ══════════════════════════════════════════════════════════════
-- STEP 4 — Add route_id FK to vehicles
-- ══════════════════════════════════════════════════════════════

DO $$ BEGIN RAISE NOTICE '[4] Adding route_id to vehicles...'; END $$;

ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS route_id UUID REFERENCES routes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_vehicles_route ON vehicles(route_id);

DO $$ BEGIN RAISE NOTICE '    [OK] vehicles.route_id'; END $$;


-- ══════════════════════════════════════════════════════════════
-- STEP 5 — Add qr_code to vehicles
-- ══════════════════════════════════════════════════════════════

DO $$ BEGIN RAISE NOTICE '[5] Adding qr_code column to vehicles...'; END $$;

ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS qr_code TEXT;

-- Unique constraint (only where not null)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'vehicles' AND indexname = 'idx_vehicles_qr_code'
  ) THEN
    CREATE UNIQUE INDEX idx_vehicles_qr_code ON vehicles(qr_code)
    WHERE qr_code IS NOT NULL;
  END IF;
END $$;

-- Back-fill QR codes for existing vehicles that don't have one
UPDATE vehicles
SET qr_code = 'cloudnext://bus/' || id::text
WHERE qr_code IS NULL;

DO $$ BEGIN RAISE NOTICE '    [OK] vehicles.qr_code (back-filled for existing vehicles)'; END $$;


-- ══════════════════════════════════════════════════════════════
-- STEP 6 — Add user_id to drivers (links to mobile app account)
-- ══════════════════════════════════════════════════════════════

DO $$ BEGIN RAISE NOTICE '[6] Adding user_id to drivers...'; END $$;

ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_drivers_user ON drivers(user_id);

DO $$ BEGIN RAISE NOTICE '    [OK] drivers.user_id'; END $$;


-- ══════════════════════════════════════════════════════════════
-- STEP 7 — DISPATCH APPROVALS table
-- ══════════════════════════════════════════════════════════════

DO $$ BEGIN RAISE NOTICE '[7] Creating dispatch_approvals table...'; END $$;

CREATE TABLE IF NOT EXISTS dispatch_approvals (
  id            UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID         NOT NULL REFERENCES tenants(id)  ON DELETE CASCADE,
  vehicle_id    UUID         NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  driver_id     UUID         NOT NULL REFERENCES drivers(id)  ON DELETE CASCADE,
  supervisor_id UUID         REFERENCES users(id)             ON DELETE SET NULL,
  qr_payload    TEXT         NOT NULL UNIQUE,  -- cloudnext://dispatch/{uuid}
  status        VARCHAR(20)  NOT NULL DEFAULT 'pending',
                -- pending | approved | expired | cancelled
  approved_at   TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ  NOT NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE dispatch_approvals IS 'QR-based trip dispatch approvals issued by supervisors';
COMMENT ON COLUMN dispatch_approvals.qr_payload IS 'Encoded in QR shown by supervisor; scanned by driver to start trip';
COMMENT ON COLUMN dispatch_approvals.expires_at  IS 'Approvals expire after 10 minutes by default';

CREATE INDEX IF NOT EXISTS idx_dispatch_qr      ON dispatch_approvals(qr_payload);
CREATE INDEX IF NOT EXISTS idx_dispatch_tenant  ON dispatch_approvals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_vehicle ON dispatch_approvals(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_driver  ON dispatch_approvals(driver_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_status  ON dispatch_approvals(status)
  WHERE status = 'pending';

-- Auto-expire stale approvals (mark as expired when status = pending and past expiry)
CREATE OR REPLACE VIEW v_pending_approvals AS
SELECT * FROM dispatch_approvals
WHERE status = 'pending' AND expires_at > NOW();

DO $$ BEGIN RAISE NOTICE '    [OK] dispatch_approvals table'; END $$;


-- ══════════════════════════════════════════════════════════════
-- STEP 8 — Triggers
-- ══════════════════════════════════════════════════════════════

DO $$ BEGIN RAISE NOTICE '[8] Setting up triggers...'; END $$;

-- Ensure the generic updated_at trigger function exists
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- routes trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_routes_updated_at'
  ) THEN
    CREATE TRIGGER trg_routes_updated_at
      BEFORE UPDATE ON routes
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

-- users.updated_at (may already exist from schema.sql)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_users_updated_at'
  ) THEN
    CREATE TRIGGER trg_users_updated_at
      BEFORE UPDATE ON users
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

DO $$ BEGIN RAISE NOTICE '    [OK] triggers'; END $$;


-- ══════════════════════════════════════════════════════════════
-- STEP 9 — Refresh / extend spatial views to include routes
-- ══════════════════════════════════════════════════════════════

DO $$ BEGIN RAISE NOTICE '[9] Refreshing v_fleet_live view (adds route info)...'; END $$;

CREATE OR REPLACE VIEW v_fleet_live AS
SELECT
  v.id,
  v.registration,
  v.make || ' ' || v.model        AS vehicle_name,
  v.make,
  v.model,
  v.year,
  v.type,
  v.status,
  v.color,
  v.current_speed,
  v.current_heading,
  v.current_fuel,
  v.current_odometer,
  v.engine_on,
  v.health_score,
  v.last_seen,
  v.qr_code,
  v.tenant_id,
  ST_AsGeoJSON(v.current_location)::json  AS location_geojson,
  ST_X(v.current_location)               AS longitude,
  ST_Y(v.current_location)               AS latitude,
  d.id                                    AS driver_id,
  d.full_name                             AS driver_name,
  d.employee_id                           AS driver_employee_id,
  d.safety_score                          AS driver_score,
  dp.id                                   AS depot_id,
  dp.name                                 AS depot_name,
  r.id                                    AS route_id,
  r.name                                  AS route_name,
  r.color                                 AS route_color,
  ST_AsGeoJSON(r.path)::json              AS route_path_geojson
FROM vehicles v
LEFT JOIN drivers d   ON v.assigned_driver_id = d.id
LEFT JOIN depots  dp  ON v.depot_id = dp.id
LEFT JOIN routes  r   ON v.route_id = r.id;

DO $$ BEGIN RAISE NOTICE '    [OK] v_fleet_live refreshed'; END $$;


-- ══════════════════════════════════════════════════════════════
-- STEP 10 — Additional indexes for performance
-- ══════════════════════════════════════════════════════════════

DO $$ BEGIN RAISE NOTICE '[10] Adding performance indexes...'; END $$;

-- Tenant-scoped indexes (critical for multi-tenant queries)
CREATE INDEX IF NOT EXISTS idx_vehicles_tenant   ON vehicles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_drivers_tenant    ON drivers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_depots_tenant     ON depots(tenant_id);
CREATE INDEX IF NOT EXISTS idx_geofences_tenant  ON geofences(tenant_id);
CREATE INDEX IF NOT EXISTS idx_alerts_tenant     ON alerts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_trips_tenant      ON trips(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_tenant      ON users(tenant_id);

-- Driver status lookup
CREATE INDEX IF NOT EXISTS idx_drivers_status ON drivers(status);

-- Vehicle registration search
CREATE INDEX IF NOT EXISTS idx_vehicles_reg_trgm ON vehicles
  USING GIN (registration gin_trgm_ops);

-- Route name search
CREATE INDEX IF NOT EXISTS idx_routes_name_trgm ON routes
  USING GIN (name gin_trgm_ops);

-- Dispatch approvals expiry cleanup
CREATE INDEX IF NOT EXISTS idx_dispatch_expires ON dispatch_approvals(expires_at)
  WHERE status = 'pending';

DO $$ BEGIN RAISE NOTICE '    [OK] indexes'; END $$;


-- ══════════════════════════════════════════════════════════════
-- STEP 11 — Expire stale pending approvals (maintenance helper)
-- ══════════════════════════════════════════════════════════════

DO $$ BEGIN RAISE NOTICE '[11] Expiring any stale dispatch approvals...'; END $$;

UPDATE dispatch_approvals
SET status = 'expired'
WHERE status = 'pending'
  AND expires_at < NOW();

DO $$ BEGIN RAISE NOTICE '    [OK] stale approvals expired'; END $$;


-- ══════════════════════════════════════════════════════════════
-- STEP 12 — Verification queries
-- ══════════════════════════════════════════════════════════════

DO $$ BEGIN RAISE NOTICE '[12] Running verification checks...'; END $$;

DO $$
DECLARE
  v_routes       INTEGER;
  v_qr_vehicles  INTEGER;
  v_total_vehicles INTEGER;
  v_approvals    INTEGER;
  v_driver_users INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_routes       FROM routes;
  SELECT COUNT(*) INTO v_total_vehicles FROM vehicles;
  SELECT COUNT(*) INTO v_qr_vehicles  FROM vehicles WHERE qr_code IS NOT NULL;
  SELECT COUNT(*) INTO v_approvals    FROM dispatch_approvals;
  SELECT COUNT(*) INTO v_driver_users FROM drivers WHERE user_id IS NOT NULL;

  RAISE NOTICE '  routes table        : % rows', v_routes;
  RAISE NOTICE '  vehicles total      : %', v_total_vehicles;
  RAISE NOTICE '  vehicles with QR    : % / %', v_qr_vehicles, v_total_vehicles;
  RAISE NOTICE '  dispatch_approvals  : % rows', v_approvals;
  RAISE NOTICE '  drivers with user   : % linked', v_driver_users;
END $$;

-- Quick schema sanity checks
SELECT
  'routes'              AS table_name,
  COUNT(*)              AS row_count,
  'path (LineString)'   AS geometry_col
FROM routes
UNION ALL
SELECT
  'dispatch_approvals',
  COUNT(*),
  'qr_payload'
FROM dispatch_approvals
UNION ALL
SELECT
  'vehicles',
  COUNT(*),
  'qr_code + route_id'
FROM vehicles;

DO $$ BEGIN RAISE NOTICE '======================================================'; END $$;
DO $$ BEGIN RAISE NOTICE '  Schema update complete!'; END $$;
DO $$ BEGIN RAISE NOTICE ''; END $$;
DO $$ BEGIN RAISE NOTICE '  Next steps:'; END $$;
DO $$ BEGIN RAISE NOTICE '    1. Run scripts/02_sample_routes.sql  — seed sample routes'; END $$;
DO $$ BEGIN RAISE NOTICE '    2. Run scripts/04_generate_driver_credentials.sql — create mobile users'; END $$;
DO $$ BEGIN RAISE NOTICE '======================================================'; END $$;
