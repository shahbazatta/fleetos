-- ============================================================
-- Migration: Routes, QR Codes, Driver Mobile Credentials
-- ============================================================

-- 1. Routes table (bus/vehicle routes as LineString paths)
CREATE TABLE IF NOT EXISTS routes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  color       VARCHAR(20) NOT NULL DEFAULT '#00d4e8',
  path        GEOMETRY(LineString, 4326) NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  distance_km NUMERIC(10,2),
  duration_min INTEGER,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_routes_tenant ON routes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_routes_path ON routes USING GIST(path);

-- 2. Add route_id to vehicles
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS route_id UUID REFERENCES routes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_vehicles_route ON vehicles(route_id);

-- 3. Add qr_code to vehicles (stores the QR payload: cloudnext://bus/{vehicle_id})
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS qr_code TEXT UNIQUE;

-- 4. Add user_id to drivers (links driver to their mobile app credentials)
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- 5. Add 'driver' and 'supervisor' roles support (users.role is VARCHAR so no enum change needed)

-- 6. Update trigger for routes
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'routes_updated_at') THEN
    CREATE TRIGGER routes_updated_at BEFORE UPDATE ON routes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

-- 7. dispatch_approvals table for supervisor QR-based dispatch workflow
CREATE TABLE IF NOT EXISTS dispatch_approvals (
  id            UUID PRIMARY KEY,
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vehicle_id    UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  driver_id     UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  supervisor_id UUID REFERENCES users(id),
  qr_payload    TEXT NOT NULL UNIQUE,
  status        VARCHAR(20) NOT NULL DEFAULT 'pending',
  approved_at   TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dispatch_approvals_qr ON dispatch_approvals(qr_payload);
CREATE INDEX IF NOT EXISTS idx_dispatch_approvals_tenant ON dispatch_approvals(tenant_id);
