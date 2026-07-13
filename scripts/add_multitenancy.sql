-- ============================================================
--  CloudNext Fleet Management — Multi-Tenancy Migration
--  Run AFTER fleet_complete.sql (or on a fresh DB)
--  psql -U postgres -d fleet_db -f add_multitenancy.sql
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ──────────────────────────────────────────────────────────
-- 1. TENANTS TABLE
-- ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tenants (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name           VARCHAR(255) NOT NULL,
  slug           VARCHAR(100) UNIQUE NOT NULL,  -- url-safe identifier
  country        VARCHAR(100) DEFAULT 'Pakistan',
  city           VARCHAR(100),
  address        TEXT,
  phone          VARCHAR(50),
  email          VARCHAR(255),
  website        VARCHAR(255),
  logo_url       TEXT,
  is_active      BOOLEAN     NOT NULL DEFAULT true,
  plan           VARCHAR(50) DEFAULT 'standard', -- trial | standard | pro | enterprise
  max_vehicles   INTEGER     DEFAULT 50,
  max_users      INTEGER     DEFAULT 10,
  settings       JSONB       DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);

-- ──────────────────────────────────────────────────────────
-- 2. ADD tenant_id TO EXISTING TABLES
-- ──────────────────────────────────────────────────────────

-- users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- depots
ALTER TABLE depots
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- drivers
ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- vehicles
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- telemetry (references vehicle which already has tenant_id — query via JOIN)
-- No direct tenant_id needed on telemetry; scope via vehicle_id JOIN

-- trips
ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- geofences
ALTER TABLE geofences
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- alerts
ALTER TABLE alerts
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- maintenance
ALTER TABLE maintenance
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- driver_scores (scoped via driver which has tenant_id)
ALTER TABLE driver_scores
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- ──────────────────────────────────────────────────────────
-- 3. PERFORMANCE INDEXES ON tenant_id
-- ──────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_users_tenant      ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_depots_tenant     ON depots(tenant_id);
CREATE INDEX IF NOT EXISTS idx_drivers_tenant    ON drivers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_tenant   ON vehicles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_trips_tenant      ON trips(tenant_id);
CREATE INDEX IF NOT EXISTS idx_geofences_tenant  ON geofences(tenant_id);
CREATE INDEX IF NOT EXISTS idx_alerts_tenant     ON alerts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_tenant ON maintenance(tenant_id);
CREATE INDEX IF NOT EXISTS idx_scores_tenant     ON driver_scores(tenant_id);

-- Compound indexes for the most common query pattern: tenant + status/time
CREATE INDEX IF NOT EXISTS idx_vehicles_tenant_status  ON vehicles(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_alerts_tenant_unread    ON alerts(tenant_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_drivers_tenant_status   ON drivers(tenant_id, status);

-- ──────────────────────────────────────────────────────────
-- 4. MAKE employee_id AND license_number TENANT-SCOPED
--    (remove old unique constraints, add composite unique)
-- ──────────────────────────────────────────────────────────

DO $$
BEGIN
  -- Drop old global unique constraints if they exist
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'drivers_employee_id_key') THEN
    ALTER TABLE drivers DROP CONSTRAINT drivers_employee_id_key;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'drivers_license_number_key') THEN
    ALTER TABLE drivers DROP CONSTRAINT drivers_license_number_key;
  END IF;
  -- vehicle registration must be unique per tenant (same reg in different companies is fine)
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vehicles_registration_key') THEN
    ALTER TABLE vehicles DROP CONSTRAINT vehicles_registration_key;
  END IF;
END $$;

-- Add tenant-scoped unique constraints
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'drivers_employee_id_tenant_unique') THEN
    ALTER TABLE drivers ADD CONSTRAINT drivers_employee_id_tenant_unique UNIQUE (tenant_id, employee_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'drivers_license_tenant_unique') THEN
    ALTER TABLE drivers ADD CONSTRAINT drivers_license_tenant_unique UNIQUE (tenant_id, license_number);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vehicles_registration_tenant_unique') THEN
    ALTER TABLE vehicles ADD CONSTRAINT vehicles_registration_tenant_unique UNIQUE (tenant_id, registration);
  END IF;
END $$;

-- ──────────────────────────────────────────────────────────
-- 5. ROW-LEVEL SECURITY (optional but recommended for prod)
--    Enable but don't enforce in app yet — use WHERE clauses
-- ──────────────────────────────────────────────────────────
-- ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
-- (Uncomment and add policies if moving to RLS-based isolation)

-- ──────────────────────────────────────────────────────────
-- 6. UPDATED_AT TRIGGER FOR TENANTS
-- ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_tenants_updated_at ON tenants;
CREATE TRIGGER trg_tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ──────────────────────────────────────────────────────────
-- 7. SEED: Create two demo tenants + assign existing data
-- ──────────────────────────────────────────────────────────

-- Tenant 1: CloudNext's own demo fleet (Lahore, Pakistan)
INSERT INTO tenants (id, name, slug, country, city, email, plan, max_vehicles, max_users)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'CloudNext Demo Fleet',
  'cloudnext-demo',
  'Pakistan', 'Lahore',
  'fleet@cloudnext.com',
  'enterprise', 100, 50
) ON CONFLICT (slug) DO NOTHING;

-- Tenant 2: Al Noor Transport (sample Middle East customer)
INSERT INTO tenants (id, name, slug, country, city, email, plan, max_vehicles, max_users)
VALUES (
  '22222222-2222-2222-2222-222222222222',
  'Al Noor Transport LLC',
  'al-noor-transport',
  'UAE', 'Dubai',
  'ops@alnoor-transport.ae',
  'pro', 30, 15
) ON CONFLICT (slug) DO NOTHING;

-- Assign all existing seed data to tenant 1
UPDATE users        SET tenant_id = '11111111-1111-1111-1111-111111111111' WHERE tenant_id IS NULL AND role != 'superadmin';
UPDATE depots       SET tenant_id = '11111111-1111-1111-1111-111111111111' WHERE tenant_id IS NULL;
UPDATE drivers      SET tenant_id = '11111111-1111-1111-1111-111111111111' WHERE tenant_id IS NULL;
UPDATE vehicles     SET tenant_id = '11111111-1111-1111-1111-111111111111' WHERE tenant_id IS NULL;
UPDATE trips        SET tenant_id = '11111111-1111-1111-1111-111111111111' WHERE tenant_id IS NULL;
UPDATE geofences    SET tenant_id = '11111111-1111-1111-1111-111111111111' WHERE tenant_id IS NULL;
UPDATE alerts       SET tenant_id = '11111111-1111-1111-1111-111111111111' WHERE tenant_id IS NULL;
UPDATE maintenance  SET tenant_id = '11111111-1111-1111-1111-111111111111' WHERE tenant_id IS NULL;
UPDATE driver_scores SET tenant_id = '11111111-1111-1111-1111-111111111111' WHERE tenant_id IS NULL;

-- Create tenant admin for Al Noor
INSERT INTO users (email, password_hash, full_name, role, tenant_id, is_active)
VALUES (
  'admin@alnoor-transport.ae',
  crypt('Admin@AlNoor2024', gen_salt('bf', 10)),
  'Al Noor Admin',
  'admin',
  '22222222-2222-2222-2222-222222222222',
  true
) ON CONFLICT (email) DO NOTHING;

-- Create demo operator for Al Noor
INSERT INTO users (email, password_hash, full_name, role, tenant_id, is_active)
VALUES (
  'operator@alnoor-transport.ae',
  crypt('Operator@AlNoor2024', gen_salt('bf', 10)),
  'Al Noor Operator',
  'operator',
  '22222222-2222-2222-2222-222222222222',
  true
) ON CONFLICT (email) DO NOTHING;

-- ──────────────────────────────────────────────────────────
-- 8. TENANT-SCOPED FLEET LIVE VIEW
-- ──────────────────────────────────────────────────────────

DROP VIEW IF EXISTS v_fleet_live CASCADE;
CREATE OR REPLACE VIEW v_fleet_live AS
SELECT
  v.id, v.tenant_id,
  v.registration,
  v.make || ' ' || v.model        AS vehicle_name,
  v.make, v.model, v.year, v.type, v.color,
  v.status,
  v.current_speed, v.current_heading,
  v.current_fuel,  v.current_odometer,
  v.engine_on, v.health_score, v.last_seen,
  v.fuel_capacity, v.max_speed,
  ST_X(v.current_location)        AS longitude,
  ST_Y(v.current_location)        AS latitude,
  ST_AsGeoJSON(v.current_location)::json AS location_geojson,
  d.id            AS driver_id,
  d.full_name     AS driver_name,
  d.phone         AS driver_phone,
  d.safety_score  AS driver_score,
  dp.id           AS depot_id,
  dp.name         AS depot_name,
  t.name          AS tenant_name,
  COALESCE(a.unread_count, 0)     AS unread_alerts
FROM vehicles v
LEFT JOIN drivers d  ON v.assigned_driver_id = d.id
LEFT JOIN depots  dp ON v.depot_id = dp.id
LEFT JOIN tenants t  ON v.tenant_id = t.id
LEFT JOIN (
  SELECT vehicle_id, COUNT(*) AS unread_count
  FROM alerts
  WHERE is_read = false AND occurred_at > NOW() - INTERVAL '24 hours'
  GROUP BY vehicle_id
) a ON a.vehicle_id = v.id;

-- ──────────────────────────────────────────────────────────
-- 9. TENANT SUMMARY FUNCTION
-- ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION tenant_kpi(p_tenant_id UUID)
RETURNS TABLE (
  total_vehicles    BIGINT,
  active_vehicles   BIGINT,
  idle_vehicles     BIGINT,
  offline_vehicles  BIGINT,
  avg_speed         NUMERIC,
  avg_fuel          NUMERIC,
  avg_health        NUMERIC,
  unread_alerts     BIGINT,
  critical_alerts   BIGINT,
  active_trips      BIGINT,
  total_drivers     BIGINT,
  avg_driver_score  NUMERIC
) LANGUAGE SQL STABLE AS $$
  SELECT
    COUNT(*)                                             AS total_vehicles,
    COUNT(*) FILTER (WHERE status = 'active')            AS active_vehicles,
    COUNT(*) FILTER (WHERE status = 'idle')              AS idle_vehicles,
    COUNT(*) FILTER (WHERE status = 'offline')           AS offline_vehicles,
    ROUND(AVG(current_speed) FILTER (WHERE status='active')::NUMERIC, 1) AS avg_speed,
    ROUND(AVG(current_fuel)::NUMERIC, 1)                AS avg_fuel,
    ROUND(AVG(health_score)::NUMERIC, 1)                AS avg_health,
    (SELECT COUNT(*) FROM alerts  WHERE tenant_id = p_tenant_id AND is_read = false),
    (SELECT COUNT(*) FROM alerts  WHERE tenant_id = p_tenant_id AND severity = 'critical' AND is_read = false),
    (SELECT COUNT(*) FROM trips   WHERE tenant_id = p_tenant_id AND status = 'active'),
    (SELECT COUNT(*) FROM drivers WHERE tenant_id = p_tenant_id AND status = 'active'),
    (SELECT ROUND(AVG(safety_score)::NUMERIC,1) FROM drivers WHERE tenant_id = p_tenant_id AND status = 'active')
  FROM vehicles WHERE tenant_id = p_tenant_id;
$$;

-- ──────────────────────────────────────────────────────────
-- 10. VERIFY
-- ──────────────────────────────────────────────────────────

SELECT 'Tenants' AS entity, COUNT(*) AS rows FROM tenants
UNION ALL SELECT 'Users with tenant',   COUNT(*) FROM users WHERE tenant_id IS NOT NULL
UNION ALL SELECT 'Vehicles with tenant',COUNT(*) FROM vehicles WHERE tenant_id IS NOT NULL
UNION ALL SELECT 'Drivers with tenant', COUNT(*) FROM drivers WHERE tenant_id IS NOT NULL
UNION ALL SELECT 'Alerts with tenant',  COUNT(*) FROM alerts WHERE tenant_id IS NOT NULL;

DO $$ BEGIN
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Multi-tenancy migration complete!';
  RAISE NOTICE '';
  RAISE NOTICE 'Tenant 1 - CloudNext Demo:';
  RAISE NOTICE '  admin@cloudnext.com / admin123';
  RAISE NOTICE '';
  RAISE NOTICE 'Tenant 2 - Al Noor Transport:';
  RAISE NOTICE '  admin@alnoor-transport.ae / Admin@AlNoor2024';
  RAISE NOTICE '  operator@alnoor-transport.ae / Operator@AlNoor2024';
  RAISE NOTICE '==============================================';
END $$;
