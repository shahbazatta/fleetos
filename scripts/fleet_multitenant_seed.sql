-- ============================================================
--  CloudNext Fleet Management -- Full Multi-Tenant Seed
--  SELF-CONTAINED: bootstraps schema then seeds 7 tenants.
--
--  Tenants: cloudnext-technologies, naqel-express, enoc-fleet,
--           q-logistics, asyad-group, agility-logistics, blz-operators
--
--  Safe to run on outdated or fresh databases.
--  Idempotent -- re-running will not duplicate data.
--
--  psql -U postgres -d fleet_db -f fleet_multitenant_seed.sql
-- ============================================================

\set ON_ERROR_STOP on
BEGIN;

-- ══════════════════════════════════════════════════════════════════════════════
-- S. SCHEMA BOOTSTRAP  (idempotent -- safe to run on ANY database state)
--    Creates all tables, columns, constraints, indexes, functions and views
--    that are missing.  Existing objects are left untouched.
-- ══════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN RAISE NOTICE '=== [S] Schema Bootstrap -- creating missing objects ==='; END $$;

-- S1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- S2. ENUM TYPES (exception-safe, safe to run when already exist)
DO $$ BEGIN CREATE TYPE vehicle_status  AS ENUM ('active','idle','offline','maintenance','alert');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE vehicle_type    AS ENUM ('truck','van','car','bus','motorcycle','heavy');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE alert_severity  AS ENUM ('critical','warning','info');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE alert_type AS ENUM (
  'speeding','geofence_enter','geofence_exit','harsh_braking','harsh_acceleration',
  'idle_timeout','sos','low_fuel','maintenance_due','offline','fatigue');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE driver_status   AS ENUM ('active','inactive','on_leave','suspended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE trip_status     AS ENUM ('planned','active','completed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE maintenance_type AS ENUM (
  'oil_change','brake_service','tire_rotation','full_service','battery',
  'transmission','electrical','bodywork','inspection','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- S3. CORE TABLES (CREATE TABLE IF NOT EXISTS)
-- Note: FKs are added separately in S5 to avoid ordering issues.

-- users
CREATE TABLE IF NOT EXISTS users (
    id            UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name     VARCHAR(255) NOT NULL,
    role          VARCHAR(50)  NOT NULL DEFAULT 'operator',
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    last_login    TIMESTAMPTZ,
    avatar_url    TEXT,
    phone         VARCHAR(50),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- tenants
CREATE TABLE IF NOT EXISTS tenants (
    id           UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    name         VARCHAR(255) NOT NULL,
    slug         VARCHAR(100) UNIQUE NOT NULL,
    country      VARCHAR(100) DEFAULT 'Pakistan',
    city         VARCHAR(100),
    address      TEXT,
    phone        VARCHAR(50),
    email        VARCHAR(255),
    website      VARCHAR(255),
    logo_url     TEXT,
    is_active    BOOLEAN      NOT NULL DEFAULT true,
    plan         VARCHAR(50)  DEFAULT 'standard',
    max_vehicles INTEGER      DEFAULT 50,
    max_users    INTEGER      DEFAULT 10,
    settings     JSONB        DEFAULT '{}',
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- depots
CREATE TABLE IF NOT EXISTS depots (
    id         UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    name       VARCHAR(255) NOT NULL,
    address    TEXT,
    city       VARCHAR(100) DEFAULT 'Lahore',
    country    VARCHAR(100) DEFAULT 'Pakistan',
    location   GEOMETRY(Point, 4326),
    capacity   INTEGER      DEFAULT 50,
    manager    VARCHAR(255),
    phone      VARCHAR(50),
    is_active  BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- drivers  (no global UNIQUE on employee_id/license -- tenant-scoped in S6)
CREATE TABLE IF NOT EXISTS drivers (
    id                UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id       VARCHAR(50)   NOT NULL,
    full_name         VARCHAR(255)  NOT NULL,
    phone             VARCHAR(50),
    email             VARCHAR(255),
    license_number    VARCHAR(100)  NOT NULL,
    license_class     VARCHAR(20)   DEFAULT 'LTV',
    license_expiry    DATE          NOT NULL,
    status            driver_status NOT NULL DEFAULT 'active',
    safety_score      NUMERIC(5,2)  DEFAULT 100.00 CHECK (safety_score BETWEEN 0 AND 100),
    total_distance_km NUMERIC(12,2) DEFAULT 0,
    total_trips       INTEGER       DEFAULT 0,
    total_hours       NUMERIC(10,2) DEFAULT 0,
    depot_id          UUID,
    photo_url         TEXT,
    emergency_contact VARCHAR(255),
    notes             TEXT,
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- vehicles  (no global UNIQUE on registration -- tenant-scoped in S6)
CREATE TABLE IF NOT EXISTS vehicles (
    id                  UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
    registration        VARCHAR(50)    NOT NULL,
    make                VARCHAR(100)   NOT NULL,
    model               VARCHAR(100)   NOT NULL,
    year                SMALLINT       NOT NULL CHECK (year BETWEEN 1990 AND 2030),
    type                vehicle_type   NOT NULL DEFAULT 'truck',
    color               VARCHAR(50),
    vin                 VARCHAR(100),
    status              vehicle_status NOT NULL DEFAULT 'offline',
    current_location    GEOMETRY(Point, 4326),
    current_speed       NUMERIC(6,2)   DEFAULT 0   CHECK (current_speed >= 0),
    current_heading     NUMERIC(6,2)   DEFAULT 0   CHECK (current_heading BETWEEN 0 AND 360),
    current_fuel        NUMERIC(5,2)   DEFAULT 100 CHECK (current_fuel BETWEEN 0 AND 100),
    current_odometer    NUMERIC(12,2)  DEFAULT 0,
    engine_on           BOOLEAN        DEFAULT FALSE,
    last_seen           TIMESTAMPTZ,
    fuel_capacity       NUMERIC(8,2)   DEFAULT 60,
    fuel_type           VARCHAR(20)    DEFAULT 'diesel',
    fuel_efficiency     NUMERIC(6,2)   DEFAULT 10,
    max_speed           NUMERIC(6,2)   DEFAULT 120,
    payload_capacity    NUMERIC(10,2),
    seats               SMALLINT,
    health_score        NUMERIC(5,2)   DEFAULT 100 CHECK (health_score BETWEEN 0 AND 100),
    last_service_date   DATE,
    last_service_km     NUMERIC(12,2),
    next_service_km     NUMERIC(12,2),
    insurance_expiry    DATE,
    registration_expiry DATE,
    assigned_driver_id  UUID,
    depot_id            UUID,
    purchase_date       DATE,
    purchase_price      NUMERIC(12,2),
    notes               TEXT,
    created_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- trips
CREATE TABLE IF NOT EXISTS trips (
    id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_id       UUID        NOT NULL,
    driver_id        UUID,
    status           trip_status NOT NULL DEFAULT 'planned',
    origin           GEOMETRY(Point, 4326),
    destination      GEOMETRY(Point, 4326),
    route_path       GEOMETRY(LineString, 4326),
    planned_path     GEOMETRY(LineString, 4326),
    origin_address   TEXT,
    dest_address     TEXT,
    planned_start    TIMESTAMPTZ,
    planned_end      TIMESTAMPTZ,
    started_at       TIMESTAMPTZ,
    completed_at     TIMESTAMPTZ,
    distance_km      NUMERIC(10,2) DEFAULT 0,
    duration_mins    INTEGER       DEFAULT 0,
    avg_speed        NUMERIC(6,2),
    max_speed        NUMERIC(6,2),
    fuel_used        NUMERIC(8,2),
    idle_time_mins   INTEGER       DEFAULT 0,
    harsh_events     INTEGER       DEFAULT 0,
    co2_kg           NUMERIC(8,2),
    load_description TEXT,
    load_weight_kg   NUMERIC(10,2),
    notes            TEXT,
    customer_ref     VARCHAR(100),
    created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- geofences
CREATE TABLE IF NOT EXISTS geofences (
    id             UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    name           VARCHAR(255) NOT NULL,
    description    TEXT,
    boundary       GEOMETRY(Polygon, 4326),
    color          VARCHAR(20)  DEFAULT '#00d4e8',
    fill_opacity   NUMERIC(3,2) DEFAULT 0.10 CHECK (fill_opacity BETWEEN 0 AND 1),
    is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
    alert_on_enter BOOLEAN      DEFAULT TRUE,
    alert_on_exit  BOOLEAN      DEFAULT TRUE,
    speed_limit    NUMERIC(6,2),
    allowed_hours  VARCHAR(100),
    zone_type      VARCHAR(50)  DEFAULT 'delivery',
    created_by     UUID,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- alerts
CREATE TABLE IF NOT EXISTS alerts (
    id              UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_id      UUID,
    driver_id       UUID,
    trip_id         UUID,
    geofence_id     UUID,
    type            alert_type     NOT NULL,
    severity        alert_severity NOT NULL DEFAULT 'warning',
    title           VARCHAR(255)   NOT NULL,
    message         TEXT,
    location        GEOMETRY(Point, 4326),
    speed           NUMERIC(6,2),
    additional_data JSONB,
    is_read         BOOLEAN        DEFAULT FALSE,
    is_resolved     BOOLEAN        DEFAULT FALSE,
    resolved_by     UUID,
    resolved_at     TIMESTAMPTZ,
    resolution_note TEXT,
    occurred_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- telemetry  (append-only time-series)
CREATE TABLE IF NOT EXISTS telemetry (
    id              BIGSERIAL    PRIMARY KEY,
    vehicle_id      UUID         NOT NULL,
    recorded_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    location        GEOMETRY(Point, 4326) NOT NULL,
    speed           NUMERIC(6,2) DEFAULT 0,
    heading         NUMERIC(6,2) DEFAULT 0,
    altitude        NUMERIC(8,2),
    accuracy        NUMERIC(8,2),
    fuel_level      NUMERIC(5,2),
    odometer        NUMERIC(12,2),
    engine_on       BOOLEAN      DEFAULT TRUE,
    rpm             INTEGER,
    engine_temp     NUMERIC(6,2),
    battery_voltage NUMERIC(5,2),
    throttle        NUMERIC(5,2),
    satellites      SMALLINT,
    trip_id         UUID
);

-- driver_scores
CREATE TABLE IF NOT EXISTS driver_scores (
    id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id           UUID        NOT NULL,
    trip_id             UUID,
    period_date         DATE        NOT NULL,
    period_type         VARCHAR(20) DEFAULT 'daily',
    overall_score       NUMERIC(5,2),
    speed_score         NUMERIC(5,2),
    braking_score       NUMERIC(5,2),
    cornering_score     NUMERIC(5,2),
    fatigue_score       NUMERIC(5,2),
    fuel_score          NUMERIC(5,2),
    speeding_events     INTEGER     DEFAULT 0,
    harsh_braking       INTEGER     DEFAULT 0,
    harsh_acceleration  INTEGER     DEFAULT 0,
    sharp_cornering     INTEGER     DEFAULT 0,
    phone_use_events    INTEGER     DEFAULT 0,
    seatbelt_violations INTEGER     DEFAULT 0,
    distance_km         NUMERIC(10,2),
    driving_hours       NUMERIC(8,2),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (driver_id, period_date, period_type)
);

-- maintenance
CREATE TABLE IF NOT EXISTS maintenance (
    id              UUID             PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_id      UUID             NOT NULL,
    type            maintenance_type NOT NULL DEFAULT 'other',
    description     TEXT,
    status          VARCHAR(50)      DEFAULT 'scheduled',
    priority        VARCHAR(20)      DEFAULT 'normal',
    scheduled_date  DATE,
    completed_date  DATE,
    odometer_at     NUMERIC(12,2),
    next_service_km NUMERIC(12,2),
    cost            NUMERIC(10,2),
    currency        VARCHAR(3)       DEFAULT 'PKR',
    parts_cost      NUMERIC(10,2),
    labour_cost     NUMERIC(10,2),
    technician      VARCHAR(255),
    workshop        VARCHAR(255),
    invoice_ref     VARCHAR(100),
    notes           TEXT,
    ai_predicted    BOOLEAN          DEFAULT FALSE,
    ai_confidence   NUMERIC(4,2),
    created_by      UUID,
    created_at      TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

-- routes  (from add_routes_qr_credentials migration)
CREATE TABLE IF NOT EXISTS routes (
    id           UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id    UUID         NOT NULL,
    name         VARCHAR(255) NOT NULL,
    description  TEXT,
    color        VARCHAR(20)  NOT NULL DEFAULT '#00d4e8',
    path         GEOMETRY(LineString, 4326) NOT NULL,
    is_active    BOOLEAN      NOT NULL DEFAULT true,
    distance_km  NUMERIC(10,2),
    duration_min INTEGER,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- dispatch_approvals  (from add_routes_qr_credentials migration)
CREATE TABLE IF NOT EXISTS dispatch_approvals (
    id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id     UUID        NOT NULL,
    vehicle_id    UUID        NOT NULL,
    driver_id     UUID        NOT NULL,
    supervisor_id UUID,
    qr_payload    TEXT        NOT NULL,
    status        VARCHAR(20) NOT NULL DEFAULT 'pending',
    approved_at   TIMESTAMPTZ,
    expires_at    TIMESTAMPTZ NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN RAISE NOTICE '    [OK] all tables created / verified'; END $$;

-- S4. ADD MISSING COLUMNS (ALTER TABLE ... ADD COLUMN IF NOT EXISTS)

-- tenant_id on every tenant-scoped table
ALTER TABLE users         ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE depots        ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE drivers       ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE vehicles      ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE trips         ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE geofences     ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE alerts        ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE maintenance   ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE driver_scores ADD COLUMN IF NOT EXISTS tenant_id UUID;

-- updated_at (may be absent on very old schemas)
ALTER TABLE users         ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE drivers       ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE vehicles      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- qr_code, route_id, user_id  (add_routes_qr_credentials migration columns)
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS qr_code  TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS route_id UUID;
ALTER TABLE drivers  ADD COLUMN IF NOT EXISTS user_id  UUID;

DO $$ BEGIN RAISE NOTICE '    [OK] all columns added / verified'; END $$;

-- S5. FOREIGN KEY CONSTRAINTS (add only when missing)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_tenant_id_fkey') THEN
    ALTER TABLE users        ADD CONSTRAINT users_tenant_id_fkey        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'depots_tenant_id_fkey') THEN
    ALTER TABLE depots       ADD CONSTRAINT depots_tenant_id_fkey       FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'drivers_tenant_id_fkey') THEN
    ALTER TABLE drivers      ADD CONSTRAINT drivers_tenant_id_fkey      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vehicles_tenant_id_fkey') THEN
    ALTER TABLE vehicles     ADD CONSTRAINT vehicles_tenant_id_fkey     FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trips_tenant_id_fkey') THEN
    ALTER TABLE trips        ADD CONSTRAINT trips_tenant_id_fkey        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'geofences_tenant_id_fkey') THEN
    ALTER TABLE geofences    ADD CONSTRAINT geofences_tenant_id_fkey    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'alerts_tenant_id_fkey') THEN
    ALTER TABLE alerts       ADD CONSTRAINT alerts_tenant_id_fkey       FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'maintenance_tenant_id_fkey') THEN
    ALTER TABLE maintenance  ADD CONSTRAINT maintenance_tenant_id_fkey  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'driver_scores_tenant_id_fkey') THEN
    ALTER TABLE driver_scores ADD CONSTRAINT driver_scores_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'routes_tenant_id_fkey') THEN
    ALTER TABLE routes       ADD CONSTRAINT routes_tenant_id_fkey       FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dispatch_approvals_tenant_id_fkey') THEN
    ALTER TABLE dispatch_approvals ADD CONSTRAINT dispatch_approvals_tenant_id_fkey  FOREIGN KEY (tenant_id)  REFERENCES tenants(id)  ON DELETE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dispatch_approvals_vehicle_id_fkey') THEN
    ALTER TABLE dispatch_approvals ADD CONSTRAINT dispatch_approvals_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dispatch_approvals_driver_id_fkey') THEN
    ALTER TABLE dispatch_approvals ADD CONSTRAINT dispatch_approvals_driver_id_fkey  FOREIGN KEY (driver_id)  REFERENCES drivers(id)  ON DELETE CASCADE; END IF;
  -- cross-table FKs
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'drivers_depot_id_fkey') THEN
    ALTER TABLE drivers  ADD CONSTRAINT drivers_depot_id_fkey             FOREIGN KEY (depot_id)           REFERENCES depots(id)   ON DELETE SET NULL; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vehicles_assigned_driver_id_fkey') THEN
    ALTER TABLE vehicles ADD CONSTRAINT vehicles_assigned_driver_id_fkey  FOREIGN KEY (assigned_driver_id) REFERENCES drivers(id)  ON DELETE SET NULL; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vehicles_depot_id_fkey') THEN
    ALTER TABLE vehicles ADD CONSTRAINT vehicles_depot_id_fkey            FOREIGN KEY (depot_id)           REFERENCES depots(id)   ON DELETE SET NULL; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vehicles_route_id_fkey') THEN
    ALTER TABLE vehicles ADD CONSTRAINT vehicles_route_id_fkey            FOREIGN KEY (route_id)           REFERENCES routes(id)   ON DELETE SET NULL; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'drivers_user_id_fkey') THEN
    ALTER TABLE drivers  ADD CONSTRAINT drivers_user_id_fkey              FOREIGN KEY (user_id)            REFERENCES users(id)    ON DELETE SET NULL; END IF;
END $$;

-- S6. UNIQUE CONSTRAINTS  (remove stale global constraints, add tenant-scoped ones)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'drivers_employee_id_key')    THEN ALTER TABLE drivers  DROP CONSTRAINT drivers_employee_id_key;    END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'drivers_license_number_key') THEN ALTER TABLE drivers  DROP CONSTRAINT drivers_license_number_key; END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vehicles_registration_key')  THEN ALTER TABLE vehicles DROP CONSTRAINT vehicles_registration_key;  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'drivers_employee_id_tenant_unique') THEN
    ALTER TABLE drivers  ADD CONSTRAINT drivers_employee_id_tenant_unique  UNIQUE (tenant_id, employee_id);    END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'drivers_license_tenant_unique') THEN
    ALTER TABLE drivers  ADD CONSTRAINT drivers_license_tenant_unique       UNIQUE (tenant_id, license_number); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vehicles_registration_tenant_unique') THEN
    ALTER TABLE vehicles ADD CONSTRAINT vehicles_registration_tenant_unique UNIQUE (tenant_id, registration);   END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vehicles_qr_code_key') THEN
    ALTER TABLE vehicles ADD CONSTRAINT vehicles_qr_code_key                UNIQUE (qr_code);                   END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dispatch_approvals_qr_payload_key') THEN
    ALTER TABLE dispatch_approvals ADD CONSTRAINT dispatch_approvals_qr_payload_key UNIQUE (qr_payload);        END IF;
END $$;

-- S7. INDEXES (CREATE INDEX IF NOT EXISTS for all)
-- Tenant lookups
CREATE INDEX IF NOT EXISTS idx_tenants_slug               ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_users_tenant               ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_depots_tenant              ON depots(tenant_id);
CREATE INDEX IF NOT EXISTS idx_drivers_tenant             ON drivers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_tenant            ON vehicles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_trips_tenant               ON trips(tenant_id);
CREATE INDEX IF NOT EXISTS idx_geofences_tenant           ON geofences(tenant_id);
CREATE INDEX IF NOT EXISTS idx_alerts_tenant              ON alerts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_tenant         ON maintenance(tenant_id);
CREATE INDEX IF NOT EXISTS idx_scores_tenant              ON driver_scores(tenant_id);
CREATE INDEX IF NOT EXISTS idx_routes_tenant              ON routes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_approvals_tenant  ON dispatch_approvals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_approvals_qr      ON dispatch_approvals(qr_payload);
-- Compound
CREATE INDEX IF NOT EXISTS idx_vehicles_tenant_status     ON vehicles(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_alerts_tenant_unread       ON alerts(tenant_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_drivers_tenant_status      ON drivers(tenant_id, status);
-- Common B-Tree
CREATE INDEX IF NOT EXISTS idx_vehicles_status            ON vehicles(status);
CREATE INDEX IF NOT EXISTS idx_vehicles_type              ON vehicles(type);
CREATE INDEX IF NOT EXISTS idx_vehicles_driver            ON vehicles(assigned_driver_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_depot             ON vehicles(depot_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_route             ON vehicles(route_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_vid_time         ON telemetry(vehicle_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_time             ON telemetry(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_trips_vehicle              ON trips(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_trips_driver               ON trips(driver_id);
CREATE INDEX IF NOT EXISTS idx_trips_status               ON trips(status);
CREATE INDEX IF NOT EXISTS idx_alerts_vehicle             ON alerts(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_alerts_type                ON alerts(type);
CREATE INDEX IF NOT EXISTS idx_alerts_severity            ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_occurred            ON alerts(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_unread              ON alerts(is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_driver_scores_driver       ON driver_scores(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_scores_date         ON driver_scores(period_date DESC);
CREATE INDEX IF NOT EXISTS idx_maintenance_vehicle        ON maintenance(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_status         ON maintenance(status);
-- Spatial GIST
CREATE INDEX IF NOT EXISTS idx_vehicles_location          ON vehicles  USING GIST(current_location);
CREATE INDEX IF NOT EXISTS idx_telemetry_location         ON telemetry USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_geofences_boundary         ON geofences USING GIST(boundary);
CREATE INDEX IF NOT EXISTS idx_depots_location            ON depots    USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_alerts_location            ON alerts    USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_routes_path                ON routes    USING GIST(path);
-- Trigram / GIN
CREATE INDEX IF NOT EXISTS idx_vehicles_reg_trgm          ON vehicles USING GIN(registration gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_drivers_name_trgm          ON drivers  USING GIN(full_name gin_trgm_ops);

DO $$ BEGIN RAISE NOTICE '    [OK] all indexes created / verified'; END $$;

-- S8. UPDATED_AT FUNCTION (CREATE OR REPLACE -- always safe)
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

-- S9. TRIGGERS (only create when not already present)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_users_updated_at')       THEN CREATE TRIGGER trg_users_updated_at       BEFORE UPDATE ON users       FOR EACH ROW EXECUTE FUNCTION update_updated_at(); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_vehicles_updated_at')    THEN CREATE TRIGGER trg_vehicles_updated_at    BEFORE UPDATE ON vehicles    FOR EACH ROW EXECUTE FUNCTION update_updated_at(); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_drivers_updated_at')     THEN CREATE TRIGGER trg_drivers_updated_at     BEFORE UPDATE ON drivers     FOR EACH ROW EXECUTE FUNCTION update_updated_at(); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_tenants_updated_at')     THEN CREATE TRIGGER trg_tenants_updated_at     BEFORE UPDATE ON tenants     FOR EACH ROW EXECUTE FUNCTION update_updated_at(); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_trips_updated_at')       THEN CREATE TRIGGER trg_trips_updated_at       BEFORE UPDATE ON trips       FOR EACH ROW EXECUTE FUNCTION update_updated_at(); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_geofences_updated_at')   THEN CREATE TRIGGER trg_geofences_updated_at   BEFORE UPDATE ON geofences   FOR EACH ROW EXECUTE FUNCTION update_updated_at(); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_maintenance_updated_at') THEN CREATE TRIGGER trg_maintenance_updated_at BEFORE UPDATE ON maintenance  FOR EACH ROW EXECUTE FUNCTION update_updated_at(); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='routes_updated_at')          THEN CREATE TRIGGER routes_updated_at          BEFORE UPDATE ON routes       FOR EACH ROW EXECUTE FUNCTION update_updated_at(); END IF;
END $$;

DO $$ BEGIN RAISE NOTICE '    [OK] triggers created / verified'; END $$;

-- S10. VIEWS & UTILITY FUNCTIONS (CREATE OR REPLACE -- always idempotent)

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
  ST_X(v.current_location)               AS longitude,
  ST_Y(v.current_location)               AS latitude,
  ST_AsGeoJSON(v.current_location)::json AS location_geojson,
  d.id           AS driver_id,
  d.full_name    AS driver_name,
  d.phone        AS driver_phone,
  d.safety_score AS driver_score,
  dp.id          AS depot_id,
  dp.name        AS depot_name,
  t.name         AS tenant_name,
  COALESCE(a.unread_count, 0) AS unread_alerts
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

CREATE OR REPLACE FUNCTION tenant_kpi(p_tenant_id UUID)
RETURNS TABLE (
  total_vehicles   BIGINT,  active_vehicles  BIGINT,
  idle_vehicles    BIGINT,  offline_vehicles BIGINT,
  avg_speed        NUMERIC, avg_fuel         NUMERIC,
  avg_health       NUMERIC, unread_alerts    BIGINT,
  critical_alerts  BIGINT,  active_trips     BIGINT,
  total_drivers    BIGINT,  avg_driver_score NUMERIC
) LANGUAGE SQL STABLE AS $$
  SELECT
    COUNT(*)                                                      AS total_vehicles,
    COUNT(*) FILTER (WHERE status = 'active')                     AS active_vehicles,
    COUNT(*) FILTER (WHERE status = 'idle')                       AS idle_vehicles,
    COUNT(*) FILTER (WHERE status = 'offline')                    AS offline_vehicles,
    ROUND(AVG(current_speed) FILTER (WHERE status='active')::NUMERIC, 1),
    ROUND(AVG(current_fuel)::NUMERIC, 1),
    ROUND(AVG(health_score)::NUMERIC, 1),
    (SELECT COUNT(*) FROM alerts  WHERE tenant_id=p_tenant_id AND is_read=false),
    (SELECT COUNT(*) FROM alerts  WHERE tenant_id=p_tenant_id AND severity='critical' AND is_read=false),
    (SELECT COUNT(*) FROM trips   WHERE tenant_id=p_tenant_id AND status='active'),
    (SELECT COUNT(*) FROM drivers WHERE tenant_id=p_tenant_id AND status='active'),
    (SELECT ROUND(AVG(safety_score)::NUMERIC,1) FROM drivers WHERE tenant_id=p_tenant_id AND status='active')
  FROM vehicles WHERE tenant_id = p_tenant_id;
$$;

DO $$ BEGIN RAISE NOTICE '    [OK] views + functions created / verified'; END $$;
DO $$ BEGIN RAISE NOTICE '=== [S] Schema Bootstrap complete -- proceeding to seed data ==='; END $$;


DO $$ BEGIN RAISE NOTICE '=== CloudNext Fleet — 7-Tenant Seed ==='; END $$;

-- ──────────────────────────────────────────────────────────────────────────────
-- 0. CLEAN previous seed data (idempotent re-run)
-- ──────────────────────────────────────────────────────────────────────────────
DELETE FROM dispatch_approvals WHERE tenant_id IN (
  SELECT id FROM tenants WHERE slug IN (
    'cloudnext-technologies','naqel-express','enoc-fleet',
    'q-logistics','asyad-group','agility-logistics','blz-operators'
  )
);
DELETE FROM driver_scores  WHERE tenant_id IN (SELECT id FROM tenants WHERE slug IN ('cloudnext-technologies','naqel-express','enoc-fleet','q-logistics','asyad-group','agility-logistics','blz-operators'));
DELETE FROM maintenance    WHERE tenant_id IN (SELECT id FROM tenants WHERE slug IN ('cloudnext-technologies','naqel-express','enoc-fleet','q-logistics','asyad-group','agility-logistics','blz-operators'));
DELETE FROM alerts         WHERE tenant_id IN (SELECT id FROM tenants WHERE slug IN ('cloudnext-technologies','naqel-express','enoc-fleet','q-logistics','asyad-group','agility-logistics','blz-operators'));
DELETE FROM telemetry      WHERE vehicle_id IN (SELECT v.id FROM vehicles v JOIN tenants t ON v.tenant_id=t.id WHERE t.slug IN ('cloudnext-technologies','naqel-express','enoc-fleet','q-logistics','asyad-group','agility-logistics','blz-operators'));
DELETE FROM trips          WHERE tenant_id IN (SELECT id FROM tenants WHERE slug IN ('cloudnext-technologies','naqel-express','enoc-fleet','q-logistics','asyad-group','agility-logistics','blz-operators'));
DELETE FROM vehicles       WHERE tenant_id IN (SELECT id FROM tenants WHERE slug IN ('cloudnext-technologies','naqel-express','enoc-fleet','q-logistics','asyad-group','agility-logistics','blz-operators'));
DELETE FROM drivers        WHERE tenant_id IN (SELECT id FROM tenants WHERE slug IN ('cloudnext-technologies','naqel-express','enoc-fleet','q-logistics','asyad-group','agility-logistics','blz-operators'));
DELETE FROM routes         WHERE tenant_id IN (SELECT id FROM tenants WHERE slug IN ('cloudnext-technologies','naqel-express','enoc-fleet','q-logistics','asyad-group','agility-logistics','blz-operators'));
DELETE FROM geofences      WHERE tenant_id IN (SELECT id FROM tenants WHERE slug IN ('cloudnext-technologies','naqel-express','enoc-fleet','q-logistics','asyad-group','agility-logistics','blz-operators'));
DELETE FROM depots         WHERE tenant_id IN (SELECT id FROM tenants WHERE slug IN ('cloudnext-technologies','naqel-express','enoc-fleet','q-logistics','asyad-group','agility-logistics','blz-operators'));
DELETE FROM users          WHERE tenant_id IN (SELECT id FROM tenants WHERE slug IN ('cloudnext-technologies','naqel-express','enoc-fleet','q-logistics','asyad-group','agility-logistics','blz-operators'));
DELETE FROM tenants        WHERE slug IN ('cloudnext-technologies','naqel-express','enoc-fleet','q-logistics','asyad-group','agility-logistics','blz-operators');

-- Superadmin (shared)
INSERT INTO users (id, email, password_hash, full_name, role, tenant_id, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'superadmin@cloudnext.solutions',
  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- password: password
  'Super Administrator', 'superadmin', NULL, true
) ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'superadmin';

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. TENANTS
-- ──────────────────────────────────────────────────────────────────────────────

INSERT INTO tenants (id, name, slug, country, city, address, phone, email, website, plan, max_vehicles, max_users, is_active) VALUES
-- 1. CloudNext Technologies — Lahore, Pakistan
('aaaaaaaa-0001-0001-0001-000000000001',
 'CloudNext Technologies', 'cloudnext-technologies',
 'Pakistan', 'Lahore', '7-B, MM Alam Road, Gulberg III, Lahore',
 '+92-42-111-265-265', 'fleet@cloudnext.solutions', 'https://cloudnext.solutions',
 'enterprise', 100, 50, true),

-- 2. Naqel Express — Riyadh, Saudi Arabia
('aaaaaaaa-0002-0002-0002-000000000002',
 'Naqel Express', 'naqel-express',
 'Saudi Arabia', 'Riyadh', 'King Fahd Road, Al Olaya, Riyadh 12211',
 '+966-11-200-9999', 'ops@naqel.com.sa', 'https://naqel.com.sa',
 'enterprise', 200, 80, true),

-- 3. ENOC Fleet Services — Dubai, UAE
('aaaaaaaa-0003-0003-0003-000000000003',
 'ENOC Fleet Services', 'enoc-fleet',
 'UAE', 'Dubai', 'ENOC HQ, Sheikh Zayed Road, Dubai',
 '+971-4-337-2222', 'fleet@enoc.com', 'https://enoc.com',
 'enterprise', 150, 60, true),

-- 4. Q-Logistics — Doha, Qatar
('aaaaaaaa-0004-0004-0004-000000000004',
 'Q-Logistics', 'q-logistics',
 'Qatar', 'Doha', 'Industrial Area, Zone 51, Doha',
 '+974-4444-7777', 'ops@q-logistics.qa', 'https://q-logistics.qa',
 'pro', 80, 30, true),

-- 5. Asyad Group — Muscat, Oman
('aaaaaaaa-0005-0005-0005-000000000005',
 'Asyad Group', 'asyad-group',
 'Oman', 'Muscat', 'Way 3522, Al Qurum, Muscat 118',
 '+968-2481-9999', 'fleet@asyad.om', 'https://asyad.om',
 'enterprise', 120, 50, true),

-- 6. Agility Logistics — Kuwait City
('aaaaaaaa-0006-0006-0006-000000000006',
 'Agility Logistics', 'agility-logistics',
 'Kuwait', 'Kuwait City', 'Shuwaikh Port Area, Kuwait City',
 '+965-2225-6666', 'ops@agility.com', 'https://agility.com',
 'pro', 90, 35, true),

-- 7. BLZ Operators — Manama, Bahrain
('aaaaaaaa-0007-0007-0007-000000000007',
 'BLZ Operators', 'blz-operators',
 'Bahrain', 'Manama', 'Hidd Industrial Area, Muharraq, Bahrain',
 '+973-1735-8888', 'ops@blz.bh', 'https://blz.bh',
 'standard', 40, 15, true);

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. USERS (admin + operator + viewer per tenant)
-- ──────────────────────────────────────────────────────────────────────────────
-- password for all: Fleet@2026

DO $$
DECLARE
  pwd_hash TEXT := '$2a$10$iKy3lxzH.KFhpuGIbVqIZelUjrL0OPKRCJjS2x3x3Mc/UrAFIBvLq';
  -- bcrypt of 'Fleet@2026'
BEGIN

-- ── CloudNext Technologies ──
INSERT INTO users (email, password_hash, full_name, role, tenant_id, is_active) VALUES
('admin@cloudnext-technologies.fleet',    pwd_hash, 'Zain ul Abideen',    'admin',    'aaaaaaaa-0001-0001-0001-000000000001', true),
('operator@cloudnext-technologies.fleet', pwd_hash, 'Sana Mirza',         'operator', 'aaaaaaaa-0001-0001-0001-000000000001', true),
('viewer@cloudnext-technologies.fleet',   pwd_hash, 'Bilal Khan',         'viewer',   'aaaaaaaa-0001-0001-0001-000000000001', true)
ON CONFLICT (email) DO NOTHING;

-- ── Naqel Express ──
INSERT INTO users (email, password_hash, full_name, role, tenant_id, is_active) VALUES
('admin@naqel-express.fleet',    pwd_hash, 'Abdullah Al-Ghamdi', 'admin',    'aaaaaaaa-0002-0002-0002-000000000002', true),
('operator@naqel-express.fleet', pwd_hash, 'Fahad Al-Otaibi',    'operator', 'aaaaaaaa-0002-0002-0002-000000000002', true),
('viewer@naqel-express.fleet',   pwd_hash, 'Sultan Al-Harbi',    'viewer',   'aaaaaaaa-0002-0002-0002-000000000002', true)
ON CONFLICT (email) DO NOTHING;

-- ── ENOC Fleet ──
INSERT INTO users (email, password_hash, full_name, role, tenant_id, is_active) VALUES
('admin@enoc-fleet.fleet',    pwd_hash, 'Mohammed Al Mansoori', 'admin',    'aaaaaaaa-0003-0003-0003-000000000003', true),
('operator@enoc-fleet.fleet', pwd_hash, 'Ali Hassan Al Zaabi',  'operator', 'aaaaaaaa-0003-0003-0003-000000000003', true),
('viewer@enoc-fleet.fleet',   pwd_hash, 'Omar Khalid Rashid',   'viewer',   'aaaaaaaa-0003-0003-0003-000000000003', true)
ON CONFLICT (email) DO NOTHING;

-- ── Q-Logistics ──
INSERT INTO users (email, password_hash, full_name, role, tenant_id, is_active) VALUES
('admin@q-logistics.fleet',    pwd_hash, 'Jassim Al-Kuwari',    'admin',    'aaaaaaaa-0004-0004-0004-000000000004', true),
('operator@q-logistics.fleet', pwd_hash, 'Khalid Al-Naimi',     'operator', 'aaaaaaaa-0004-0004-0004-000000000004', true),
('viewer@q-logistics.fleet',   pwd_hash, 'Hamad Al-Marri',      'viewer',   'aaaaaaaa-0004-0004-0004-000000000004', true)
ON CONFLICT (email) DO NOTHING;

-- ── Asyad Group ──
INSERT INTO users (email, password_hash, full_name, role, tenant_id, is_active) VALUES
('admin@asyad-group.fleet',    pwd_hash, 'Tariq Al-Balushi',    'admin',    'aaaaaaaa-0005-0005-0005-000000000005', true),
('operator@asyad-group.fleet', pwd_hash, 'Yousuf Al-Hinai',     'operator', 'aaaaaaaa-0005-0005-0005-000000000005', true),
('viewer@asyad-group.fleet',   pwd_hash, 'Nasser Al-Rawahi',    'viewer',   'aaaaaaaa-0005-0005-0005-000000000005', true)
ON CONFLICT (email) DO NOTHING;

-- ── Agility Logistics ──
INSERT INTO users (email, password_hash, full_name, role, tenant_id, is_active) VALUES
('admin@agility-logistics.fleet',    pwd_hash, 'Ahmad Al-Mutairi',   'admin',    'aaaaaaaa-0006-0006-0006-000000000006', true),
('operator@agility-logistics.fleet', pwd_hash, 'Nawaf Al-Shammari',  'operator', 'aaaaaaaa-0006-0006-0006-000000000006', true),
('viewer@agility-logistics.fleet',   pwd_hash, 'Bader Al-Sabah',     'viewer',   'aaaaaaaa-0006-0006-0006-000000000006', true)
ON CONFLICT (email) DO NOTHING;

-- ── BLZ Operators ──
INSERT INTO users (email, password_hash, full_name, role, tenant_id, is_active) VALUES
('admin@blz-operators.fleet',    pwd_hash, 'Khalid Al-Khalifa',  'admin',    'aaaaaaaa-0007-0007-0007-000000000007', true),
('operator@blz-operators.fleet', pwd_hash, 'Yusuf Al-Zayani',    'operator', 'aaaaaaaa-0007-0007-0007-000000000007', true),
('viewer@blz-operators.fleet',   pwd_hash, 'Hassan Al-Alawi',    'viewer',   'aaaaaaaa-0007-0007-0007-000000000007', true)
ON CONFLICT (email) DO NOTHING;

END $$;

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. DEPOTS
-- ──────────────────────────────────────────────────────────────────────────────

INSERT INTO depots (id, tenant_id, name, address, city, country, location, capacity, manager, phone, is_active) VALUES

-- CloudNext Technologies (Lahore)
('dddd0001-0001-0001-0001-000000000001','aaaaaaaa-0001-0001-0001-000000000001',
 'Main Hub — Lahore','MM Alam Road, Gulberg III','Lahore','Pakistan',
 ST_SetSRID(ST_MakePoint(74.3587,31.5204),4326), 60,'Usman Malik','+92-300-1111111',true),

('dddd0001-0001-0001-0001-000000000002','aaaaaaaa-0001-0001-0001-000000000001',
 'DHA Depot','Phase 5, DHA, Lahore','Lahore','Pakistan',
 ST_SetSRID(ST_MakePoint(74.4082,31.4697),4326), 40,'Asad Baig','+92-300-2222222',true),

-- Naqel Express (Riyadh)
('dddd0002-0002-0002-0002-000000000001','aaaaaaaa-0002-0002-0002-000000000002',
 'Riyadh Central Hub','King Fahd Road, Olaya','Riyadh','Saudi Arabia',
 ST_SetSRID(ST_MakePoint(46.6730,24.7100),4326), 100,'Abdulaziz Al-Dossary','+966-55-1111111',true),

('dddd0002-0002-0002-0002-000000000002','aaaaaaaa-0002-0002-0002-000000000002',
 'Jeddah Depot','Industrial City, Jeddah','Jeddah','Saudi Arabia',
 ST_SetSRID(ST_MakePoint(39.1734,21.4858),4326), 80,'Samir Al-Zahrani','+966-55-2222222',true),

-- ENOC Fleet (Dubai)
('dddd0003-0003-0003-0003-000000000001','aaaaaaaa-0003-0003-0003-000000000003',
 'Dubai Main Terminal','Sheikh Zayed Rd, Al Quoz','Dubai','UAE',
 ST_SetSRID(ST_MakePoint(55.2000,25.1500),4326), 80,'Rashid Al-Falasi','+971-50-1111111',true),

('dddd0003-0003-0003-0003-000000000002','aaaaaaaa-0003-0003-0003-000000000003',
 'Jebel Ali Depot','Jebel Ali Free Zone','Dubai','UAE',
 ST_SetSRID(ST_MakePoint(55.0200,24.9900),4326), 60,'Saeed Al-Maktoum','+971-50-2222222',true),

-- Q-Logistics (Doha)
('dddd0004-0004-0004-0004-000000000001','aaaaaaaa-0004-0004-0004-000000000004',
 'Doha Industrial Depot','Industrial Area, Zone 51','Doha','Qatar',
 ST_SetSRID(ST_MakePoint(51.4900,25.2500),4326), 50,'Saoud Al-Thani','+974-5555-1111',true),

-- Asyad Group (Muscat)
('dddd0005-0005-0005-0005-000000000001','aaaaaaaa-0005-0005-0005-000000000005',
 'Muscat Port Depot','Mina Sultan Qaboos, Muscat','Muscat','Oman',
 ST_SetSRID(ST_MakePoint(58.5900,23.6200),4326), 60,'Hilal Al-Siyabi','+968-9999-1111',true),

-- Agility Logistics (Kuwait)
('dddd0006-0006-0006-0006-000000000001','aaaaaaaa-0006-0006-0006-000000000006',
 'Shuwaikh Warehouse','Shuwaikh Port Area','Kuwait City','Kuwait',
 ST_SetSRID(ST_MakePoint(47.9300,29.3600),4326), 50,'Faisal Al-Rashidi','+965-9999-2222',true),

-- BLZ Operators (Bahrain)
('dddd0007-0007-0007-0007-000000000001','aaaaaaaa-0007-0007-0007-000000000007',
 'Hidd Industrial Base','Hidd Industrial Area, Muharraq','Manama','Bahrain',
 ST_SetSRID(ST_MakePoint(50.6300,26.2100),4326), 30,'Hassan Al-Dosari','+973-3666-1111',true);

-- ──────────────────────────────────────────────────────────────────────────────
-- 4. ROUTES (6 per tenant matching simulator waypoints)
-- ──────────────────────────────────────────────────────────────────────────────

INSERT INTO routes (id, tenant_id, name, description, color, path, is_active, duration_min) VALUES

-- ── CloudNext Technologies (Lahore) ──
('00000001-0001-0001-0001-000000000001','aaaaaaaa-0001-0001-0001-000000000001',
 'MM Alam Circuit','Gulberg commercial zone loop','#00d4e8',
 ST_SetSRID(ST_GeomFromText('LINESTRING(74.358 31.517, 74.370 31.515, 74.382 31.512, 74.370 31.517, 74.358 31.517)'),4326),
 true,25),

('00000001-0001-0001-0001-000000000002','aaaaaaaa-0001-0001-0001-000000000001',
 'Canal Bank Express','Canal road freight corridor','#a3e635',
 ST_SetSRID(ST_GeomFromText('LINESTRING(74.320 31.490, 74.340 31.490, 74.360 31.490, 74.340 31.492, 74.320 31.490)'),4326),
 true,30),

('00000001-0001-0001-0001-000000000003','aaaaaaaa-0001-0001-0001-000000000001',
 'Ferozpur Road Route','South Lahore distribution','#f59e0b',
 ST_SetSRID(ST_GeomFromText('LINESTRING(74.320 31.530, 74.340 31.520, 74.360 31.510, 74.340 31.520, 74.320 31.530)'),4326),
 true,35),

('00000001-0001-0001-0001-000000000004','aaaaaaaa-0001-0001-0001-000000000001',
 'GT Road Corridor','Lahore–Gujranwala north route','#ef4444',
 ST_SetSRID(ST_GeomFromText('LINESTRING(74.380 31.550, 74.400 31.548, 74.420 31.545, 74.400 31.549, 74.380 31.550)'),4326),
 true,40),

('00000001-0001-0001-0001-000000000005','aaaaaaaa-0001-0001-0001-000000000001',
 'Bedian Road Run','Airport south access','#8b5cf6',
 ST_SetSRID(ST_GeomFromText('LINESTRING(74.410 31.460, 74.420 31.480, 74.430 31.500, 74.420 31.480, 74.410 31.460)'),4326),
 true,28),

('00000001-0001-0001-0001-000000000006','aaaaaaaa-0001-0001-0001-000000000001',
 'Raiwind Road Loop','South suburban loop','#06b6d4',
 ST_SetSRID(ST_GeomFromText('LINESTRING(74.310 31.470, 74.320 31.490, 74.330 31.510, 74.320 31.490, 74.310 31.470)'),4326),
 true,22),

-- ── Naqel Express (Riyadh) ──
('00000002-0002-0002-0002-000000000001','aaaaaaaa-0002-0002-0002-000000000002',
 'King Fahd Corridor','Central Riyadh primary spine','#00d4e8',
 ST_SetSRID(ST_GeomFromText('LINESTRING(46.6730 24.7100, 46.7130 24.6960, 46.7530 24.6820, 46.7130 24.6960, 46.6730 24.7100)'),4326),
 true,40),

('00000002-0002-0002-0002-000000000002','aaaaaaaa-0002-0002-0002-000000000002',
 'Northern Ring Road','North Riyadh ring distribution','#a3e635',
 ST_SetSRID(ST_GeomFromText('LINESTRING(46.6500 24.7600, 46.7000 24.7700, 46.7500 24.7800, 46.7000 24.7700, 46.6500 24.7600)'),4326),
 true,45),

('00000002-0002-0002-0002-000000000003','aaaaaaaa-0002-0002-0002-000000000002',
 'Olaya Street Route','Business district delivery','#f59e0b',
 ST_SetSRID(ST_GeomFromText('LINESTRING(46.6820 24.6930, 46.6880 24.7080, 46.6940 24.7230, 46.6880 24.7080, 46.6820 24.6930)'),4326),
 true,30),

('00000002-0002-0002-0002-000000000004','aaaaaaaa-0002-0002-0002-000000000002',
 'Mecca Expressway','West Riyadh freight corridor','#ef4444',
 ST_SetSRID(ST_GeomFromText('LINESTRING(46.6100 24.6700, 46.6600 24.6750, 46.7100 24.6800, 46.6600 24.6750, 46.6100 24.6700)'),4326),
 true,50),

('00000002-0002-0002-0002-000000000005','aaaaaaaa-0002-0002-0002-000000000002',
 'Eastern Ring Road','East industrial zone run','#8b5cf6',
 ST_SetSRID(ST_GeomFromText('LINESTRING(46.8200 24.6500, 46.8500 24.7000, 46.8800 24.7500, 46.8500 24.7000, 46.8200 24.6500)'),4326),
 true,55),

('00000002-0002-0002-0002-000000000006','aaaaaaaa-0002-0002-0002-000000000002',
 'Airport Road','King Khalid Airport connector','#06b6d4',
 ST_SetSRID(ST_GeomFromText('LINESTRING(46.6983 24.8100, 46.6983 24.8600, 46.6983 24.9100, 46.6983 24.8600, 46.6983 24.8100)'),4326),
 true,35),

-- ── ENOC Fleet (Dubai) ──
('00000003-0003-0003-0003-000000000001','aaaaaaaa-0003-0003-0003-000000000003',
 'Sheikh Zayed Road','Main Dubai spine — southbound','#00d4e8',
 ST_SetSRID(ST_GeomFromText('LINESTRING(55.1400 25.0900, 55.1800 25.1200, 55.2200 25.1600, 55.1800 25.1200, 55.1400 25.0900)'),4326),
 true,35),

('00000003-0003-0003-0003-000000000002','aaaaaaaa-0003-0003-0003-000000000003',
 'Al Khail Road','Parallel highway distribution','#a3e635',
 ST_SetSRID(ST_GeomFromText('LINESTRING(55.1800 25.0600, 55.2200 25.1000, 55.2600 25.1400, 55.2200 25.1000, 55.1800 25.0600)'),4326),
 true,40),

('00000003-0003-0003-0003-000000000003','aaaaaaaa-0003-0003-0003-000000000003',
 'Jebel Ali Corridor','Port to city freight','#f59e0b',
 ST_SetSRID(ST_GeomFromText('LINESTRING(55.0000 24.9800, 55.0500 24.9900, 55.1000 25.0000, 55.0500 24.9900, 55.0000 24.9800)'),4326),
 true,50),

('00000003-0003-0003-0003-000000000004','aaaaaaaa-0003-0003-0003-000000000003',
 'Dubai Creek Road','Historic area east-west','#ef4444',
 ST_SetSRID(ST_GeomFromText('LINESTRING(55.2800 25.2300, 55.3100 25.2400, 55.3400 25.2500, 55.3100 25.2400, 55.2800 25.2300)'),4326),
 true,25),

('00000003-0003-0003-0003-000000000005','aaaaaaaa-0003-0003-0003-000000000003',
 'Emirates Road E611','Outer ring highway','#8b5cf6',
 ST_SetSRID(ST_GeomFromText('LINESTRING(55.3000 25.0500, 55.3500 25.1200, 55.4000 25.1900, 55.3500 25.1200, 55.3000 25.0500)'),4326),
 true,60),

('00000003-0003-0003-0003-000000000006','aaaaaaaa-0003-0003-0003-000000000003',
 'Al Qudra Road','Desert south access','#06b6d4',
 ST_SetSRID(ST_GeomFromText('LINESTRING(55.1500 25.0000, 55.2000 24.9800, 55.2500 24.9600, 55.2000 24.9800, 55.1500 25.0000)'),4326),
 true,45),

-- ── Q-Logistics (Doha) ──
('00000004-0004-0004-0004-000000000001','aaaaaaaa-0004-0004-0004-000000000004',
 'Al Shamal Highway','North Qatar arterial','#00d4e8',
 ST_SetSRID(ST_GeomFromText('LINESTRING(51.5200 25.2900, 51.5200 25.3500, 51.5200 25.4100, 51.5200 25.3500, 51.5200 25.2900)'),4326),
 true,40),

('00000004-0004-0004-0004-000000000002','aaaaaaaa-0004-0004-0004-000000000004',
 'Salwa Road','South Doha distribution','#a3e635',
 ST_SetSRID(ST_GeomFromText('LINESTRING(51.5100 25.2800, 51.4700 25.2500, 51.4300 25.2200, 51.4700 25.2500, 51.5100 25.2800)'),4326),
 true,35),

('00000004-0004-0004-0004-000000000003','aaaaaaaa-0004-0004-0004-000000000004',
 'Corniche Route','Waterfront delivery loop','#f59e0b',
 ST_SetSRID(ST_GeomFromText('LINESTRING(51.5000 25.2900, 51.5200 25.3100, 51.5400 25.3300, 51.5200 25.3100, 51.5000 25.2900)'),4326),
 true,20),

('00000004-0004-0004-0004-000000000004','aaaaaaaa-0004-0004-0004-000000000004',
 'Hamad Port Access','Container terminal run','#ef4444',
 ST_SetSRID(ST_GeomFromText('LINESTRING(51.5300 25.1400, 51.5400 25.1700, 51.5500 25.2000, 51.5400 25.1700, 51.5300 25.1400)'),4326),
 true,45),

('00000004-0004-0004-0004-000000000005','aaaaaaaa-0004-0004-0004-000000000004',
 'Airport Expressway','HAIA cargo route','#8b5cf6',
 ST_SetSRID(ST_GeomFromText('LINESTRING(51.5500 25.2500, 51.5700 25.2600, 51.5900 25.2700, 51.5700 25.2600, 51.5500 25.2500)'),4326),
 true,25),

('00000004-0004-0004-0004-000000000006','aaaaaaaa-0004-0004-0004-000000000004',
 'Industrial Area Loop','Zone 51 internal circuit','#06b6d4',
 ST_SetSRID(ST_GeomFromText('LINESTRING(51.4400 25.2300, 51.4600 25.2400, 51.4800 25.2500, 51.4600 25.2400, 51.4400 25.2300)'),4326),
 true,15),

-- ── Asyad Group (Muscat) ──
('00000005-0005-0005-0005-000000000001','aaaaaaaa-0005-0005-0005-000000000005',
 'Sultan Qaboos Highway','Muscat main spine east','#00d4e8',
 ST_SetSRID(ST_GeomFromText('LINESTRING(58.4800 23.5800, 58.5300 23.5900, 58.5800 23.6000, 58.5300 23.5900, 58.4800 23.5800)'),4326),
 true,35),

('00000005-0005-0005-0005-000000000002','aaaaaaaa-0005-0005-0005-000000000005',
 'Al Batinah Coastal','North coast freight','#a3e635',
 ST_SetSRID(ST_GeomFromText('LINESTRING(58.3000 23.6500, 58.4000 23.6400, 58.5000 23.6300, 58.4000 23.6400, 58.3000 23.6500)'),4326),
 true,50),

('00000005-0005-0005-0005-000000000003','aaaaaaaa-0005-0005-0005-000000000005',
 'Ruwi Muttrah Road','Old Muscat urban delivery','#f59e0b',
 ST_SetSRID(ST_GeomFromText('LINESTRING(58.5700 23.6100, 58.5900 23.6200, 58.6100 23.6300, 58.5900 23.6200, 58.5700 23.6100)'),4326),
 true,20),

('00000005-0005-0005-0005-000000000004','aaaaaaaa-0005-0005-0005-000000000005',
 'Airport Connector','Muscat International run','#ef4444',
 ST_SetSRID(ST_GeomFromText('LINESTRING(58.2500 23.5700, 58.2700 23.5800, 58.2900 23.5900, 58.2700 23.5800, 58.2500 23.5700)'),4326),
 true,30),

('00000005-0005-0005-0005-000000000005','aaaaaaaa-0005-0005-0005-000000000005',
 'Rusayl Industrial','West industrial zone loop','#8b5cf6',
 ST_SetSRID(ST_GeomFromText('LINESTRING(58.1500 23.5500, 58.1700 23.5600, 58.1900 23.5700, 58.1700 23.5600, 58.1500 23.5500)'),4326),
 true,25),

('00000005-0005-0005-0005-000000000006','aaaaaaaa-0005-0005-0005-000000000005',
 'Muscat Expressway','Cross-city bypass','#06b6d4',
 ST_SetSRID(ST_GeomFromText('LINESTRING(58.5000 23.5600, 58.5500 23.5800, 58.6000 23.6000, 58.5500 23.5800, 58.5000 23.5600)'),4326),
 true,40),

-- ── Agility Logistics (Kuwait) ──
('00000006-0006-0006-0006-000000000001','aaaaaaaa-0006-0006-0006-000000000006',
 'Gulf Road','Coastal north route','#00d4e8',
 ST_SetSRID(ST_GeomFromText('LINESTRING(47.9500 29.3500, 47.9700 29.3700, 47.9900 29.3900, 47.9700 29.3700, 47.9500 29.3500)'),4326),
 true,25),

('00000006-0006-0006-0006-000000000002','aaaaaaaa-0006-0006-0006-000000000006',
 'Fahaheel Expressway','South Kuwait industrial','#a3e635',
 ST_SetSRID(ST_GeomFromText('LINESTRING(47.9800 29.3200, 48.0300 29.2800, 48.0800 29.2400, 48.0300 29.2800, 47.9800 29.3200)'),4326),
 true,40),

('00000006-0006-0006-0006-000000000003','aaaaaaaa-0006-0006-0006-000000000006',
 'Airport Road Kuwait','KWI cargo connector','#f59e0b',
 ST_SetSRID(ST_GeomFromText('LINESTRING(47.9500 29.2800, 47.9600 29.2600, 47.9700 29.2400, 47.9600 29.2600, 47.9500 29.2800)'),4326),
 true,30),

('00000006-0006-0006-0006-000000000004','aaaaaaaa-0006-0006-0006-000000000006',
 'Shuwaikh Port Loop','Port access circuit','#ef4444',
 ST_SetSRID(ST_GeomFromText('LINESTRING(47.9200 29.3600, 47.9400 29.3700, 47.9600 29.3800, 47.9400 29.3700, 47.9200 29.3600)'),4326),
 true,15),

('00000006-0006-0006-0006-000000000005','aaaaaaaa-0006-0006-0006-000000000006',
 '5th Ring Road','Outer city distribution','#8b5cf6',
 ST_SetSRID(ST_GeomFromText('LINESTRING(47.9000 29.3300, 47.9500 29.3100, 48.0000 29.2900, 47.9500 29.3100, 47.9000 29.3300)'),4326),
 true,35),

('00000006-0006-0006-0006-000000000006','aaaaaaaa-0006-0006-0006-000000000006',
 'Jahra Road','West Kuwait inland run','#06b6d4',
 ST_SetSRID(ST_GeomFromText('LINESTRING(47.8000 29.3500, 47.8500 29.3400, 47.9000 29.3300, 47.8500 29.3400, 47.8000 29.3500)'),4326),
 true,50),

-- ── BLZ Operators (Bahrain) ──
('00000007-0007-0007-0007-000000000001','aaaaaaaa-0007-0007-0007-000000000007',
 'King Fahd Causeway Run','Saudi border connector','#00d4e8',
 ST_SetSRID(ST_GeomFromText('LINESTRING(50.4800 26.1900, 50.5200 26.2000, 50.5600 26.2100, 50.5200 26.2000, 50.4800 26.1900)'),4326),
 true,30),

('00000007-0007-0007-0007-000000000002','aaaaaaaa-0007-0007-0007-000000000007',
 'Sheikh Khalifa Highway','Capital city spine','#a3e635',
 ST_SetSRID(ST_GeomFromText('LINESTRING(50.5500 26.2000, 50.5700 26.2200, 50.5900 26.2400, 50.5700 26.2200, 50.5500 26.2000)'),4326),
 true,20),

('00000007-0007-0007-0007-000000000003','aaaaaaaa-0007-0007-0007-000000000007',
 'Port Access Road','Khalifa Bin Salman Port','#f59e0b',
 ST_SetSRID(ST_GeomFromText('LINESTRING(50.6000 26.2000, 50.6200 26.2100, 50.6400 26.2200, 50.6200 26.2100, 50.6000 26.2000)'),4326),
 true,15),

('00000007-0007-0007-0007-000000000004','aaaaaaaa-0007-0007-0007-000000000007',
 'Hidd Industrial Loop','Industrial zone circuit','#ef4444',
 ST_SetSRID(ST_GeomFromText('LINESTRING(50.6300 26.2100, 50.6500 26.2200, 50.6700 26.2300, 50.6500 26.2200, 50.6300 26.2100)'),4326),
 true,20),

('00000007-0007-0007-0007-000000000005','aaaaaaaa-0007-0007-0007-000000000007',
 'BLZ Perimeter Road','Yard perimeter patrol','#8b5cf6',
 ST_SetSRID(ST_GeomFromText('LINESTRING(50.6100 26.2200, 50.6200 26.2350, 50.6300 26.2500, 50.6200 26.2350, 50.6100 26.2200)'),4326),
 true,10),

('00000007-0007-0007-0007-000000000006','aaaaaaaa-0007-0007-0007-000000000007',
 'Al Areen Riffa Road','South Bahrain corridor','#06b6d4',
 ST_SetSRID(ST_GeomFromText('LINESTRING(50.5400 26.1400, 50.5600 26.1600, 50.5800 26.1800, 50.5600 26.1600, 50.5400 26.1400)'),4326),
 true,35);

-- ──────────────────────────────────────────────────────────────────────────────
-- 5. DRIVER USERS (viewer role — mobile app login)
-- ──────────────────────────────────────────────────────────────────────────────
-- password for all drivers: Driver@2026

DO $$
DECLARE
  drv_hash TEXT := '$2a$10$iKy3lxzH.KFhpuGIbVqIZelUjrL0OPKRCJjS2x3x3Mc/UrAFIBvLq';
BEGIN

-- CloudNext drivers
INSERT INTO users (id, email, password_hash, full_name, role, tenant_id, is_active) VALUES
('00000001-d001-d001-d001-000000000001','drv001@cloudnext-technologies.fleet',drv_hash,'Ahmed Raza','viewer','aaaaaaaa-0001-0001-0001-000000000001',true),
('00000001-d002-d002-d002-000000000001','drv002@cloudnext-technologies.fleet',drv_hash,'Kamran Iqbal','viewer','aaaaaaaa-0001-0001-0001-000000000001',true),
('00000001-d003-d003-d003-000000000001','drv003@cloudnext-technologies.fleet',drv_hash,'Tariq Mehmood','viewer','aaaaaaaa-0001-0001-0001-000000000001',true),
('00000001-d004-d004-d004-000000000001','drv004@cloudnext-technologies.fleet',drv_hash,'Nasir Hussain','viewer','aaaaaaaa-0001-0001-0001-000000000001',true),
('00000001-d005-d005-d005-000000000001','drv005@cloudnext-technologies.fleet',drv_hash,'Sajjad Ali','viewer','aaaaaaaa-0001-0001-0001-000000000001',true),
('00000001-d006-d006-d006-000000000001','drv006@cloudnext-technologies.fleet',drv_hash,'Zahid Ullah','viewer','aaaaaaaa-0001-0001-0001-000000000001',true)
ON CONFLICT (email) DO NOTHING;

-- Naqel Express drivers
INSERT INTO users (id, email, password_hash, full_name, role, tenant_id, is_active) VALUES
('00000002-d001-d001-d001-000000000001','drv001@naqel-express.fleet',drv_hash,'Faris Al-Ghamdi','viewer','aaaaaaaa-0002-0002-0002-000000000002',true),
('00000002-d002-d002-d002-000000000001','drv002@naqel-express.fleet',drv_hash,'Saad Al-Qahtani','viewer','aaaaaaaa-0002-0002-0002-000000000002',true),
('00000002-d003-d003-d003-000000000001','drv003@naqel-express.fleet',drv_hash,'Omar Al-Otaibi','viewer','aaaaaaaa-0002-0002-0002-000000000002',true),
('00000002-d004-d004-d004-000000000001','drv004@naqel-express.fleet',drv_hash,'Bandar Al-Harbi','viewer','aaaaaaaa-0002-0002-0002-000000000002',true),
('00000002-d005-d005-d005-000000000001','drv005@naqel-express.fleet',drv_hash,'Turki Al-Anazi','viewer','aaaaaaaa-0002-0002-0002-000000000002',true),
('00000002-d006-d006-d006-000000000001','drv006@naqel-express.fleet',drv_hash,'Muteb Al-Shehri','viewer','aaaaaaaa-0002-0002-0002-000000000002',true)
ON CONFLICT (email) DO NOTHING;

-- ENOC Fleet drivers
INSERT INTO users (id, email, password_hash, full_name, role, tenant_id, is_active) VALUES
('00000003-d001-d001-d001-000000000001','drv001@enoc-fleet.fleet',drv_hash,'Saeed Al-Mazrouei','viewer','aaaaaaaa-0003-0003-0003-000000000003',true),
('00000003-d002-d002-d002-000000000001','drv002@enoc-fleet.fleet',drv_hash,'Khalid Al-Suwaidi','viewer','aaaaaaaa-0003-0003-0003-000000000003',true),
('00000003-d003-d003-d003-000000000001','drv003@enoc-fleet.fleet',drv_hash,'Hamad Al-Ameri','viewer','aaaaaaaa-0003-0003-0003-000000000003',true),
('00000003-d004-d004-d004-000000000001','drv004@enoc-fleet.fleet',drv_hash,'Yousef Al-Dhaheri','viewer','aaaaaaaa-0003-0003-0003-000000000003',true),
('00000003-d005-d005-d005-000000000001','drv005@enoc-fleet.fleet',drv_hash,'Salem Al-Nuaimi','viewer','aaaaaaaa-0003-0003-0003-000000000003',true),
('00000003-d006-d006-d006-000000000001','drv006@enoc-fleet.fleet',drv_hash,'Rashid Al-Ketbi','viewer','aaaaaaaa-0003-0003-0003-000000000003',true)
ON CONFLICT (email) DO NOTHING;

-- Q-Logistics drivers
INSERT INTO users (id, email, password_hash, full_name, role, tenant_id, is_active) VALUES
('00000004-d001-d001-d001-000000000001','drv001@q-logistics.fleet',drv_hash,'Ahmed Al-Hajri','viewer','aaaaaaaa-0004-0004-0004-000000000004',true),
('00000004-d002-d002-d002-000000000001','drv002@q-logistics.fleet',drv_hash,'Nasser Al-Sulaiti','viewer','aaaaaaaa-0004-0004-0004-000000000004',true),
('00000004-d003-d003-d003-000000000001','drv003@q-logistics.fleet',drv_hash,'Khalid Al-Dosari','viewer','aaaaaaaa-0004-0004-0004-000000000004',true),
('00000004-d004-d004-d004-000000000001','drv004@q-logistics.fleet',drv_hash,'Ibrahim Al-Ansari','viewer','aaaaaaaa-0004-0004-0004-000000000004',true),
('00000004-d005-d005-d005-000000000001','drv005@q-logistics.fleet',drv_hash,'Fahad Al-Buainain','viewer','aaaaaaaa-0004-0004-0004-000000000004',true)
ON CONFLICT (email) DO NOTHING;

-- Asyad Group drivers
INSERT INTO users (id, email, password_hash, full_name, role, tenant_id, is_active) VALUES
('00000005-d001-d001-d001-000000000001','drv001@asyad-group.fleet',drv_hash,'Said Al-Kindi','viewer','aaaaaaaa-0005-0005-0005-000000000005',true),
('00000005-d002-d002-d002-000000000001','drv002@asyad-group.fleet',drv_hash,'Sulaiman Al-Farsi','viewer','aaaaaaaa-0005-0005-0005-000000000005',true),
('00000005-d003-d003-d003-000000000001','drv003@asyad-group.fleet',drv_hash,'Majid Al-Habsi','viewer','aaaaaaaa-0005-0005-0005-000000000005',true),
('00000005-d004-d004-d004-000000000001','drv004@asyad-group.fleet',drv_hash,'Badr Al-Rashdi','viewer','aaaaaaaa-0005-0005-0005-000000000005',true),
('00000005-d005-d005-d005-000000000001','drv005@asyad-group.fleet',drv_hash,'Khalid Al-Zadjali','viewer','aaaaaaaa-0005-0005-0005-000000000005',true)
ON CONFLICT (email) DO NOTHING;

-- Agility Logistics drivers
INSERT INTO users (id, email, password_hash, full_name, role, tenant_id, is_active) VALUES
('00000006-d001-d001-d001-000000000001','drv001@agility-logistics.fleet',drv_hash,'Walid Al-Mutawa','viewer','aaaaaaaa-0006-0006-0006-000000000006',true),
('00000006-d002-d002-d002-000000000001','drv002@agility-logistics.fleet',drv_hash,'Tariq Al-Fahad','viewer','aaaaaaaa-0006-0006-0006-000000000006',true),
('00000006-d003-d003-d003-000000000001','drv003@agility-logistics.fleet',drv_hash,'Salem Al-Enezi','viewer','aaaaaaaa-0006-0006-0006-000000000006',true),
('00000006-d004-d004-d004-000000000001','drv004@agility-logistics.fleet',drv_hash,'Nasser Al-Rashidi','viewer','aaaaaaaa-0006-0006-0006-000000000006',true),
('00000006-d005-d005-d005-000000000001','drv005@agility-logistics.fleet',drv_hash,'Bader Al-Hajri','viewer','aaaaaaaa-0006-0006-0006-000000000006',true)
ON CONFLICT (email) DO NOTHING;

-- BLZ Operators drivers
INSERT INTO users (id, email, password_hash, full_name, role, tenant_id, is_active) VALUES
('00000007-d001-d001-d001-000000000001','drv001@blz-operators.fleet',drv_hash,'Khalil Al-Rumaihi','viewer','aaaaaaaa-0007-0007-0007-000000000007',true),
('00000007-d002-d002-d002-000000000001','drv002@blz-operators.fleet',drv_hash,'Yusuf Al-Mannai','viewer','aaaaaaaa-0007-0007-0007-000000000007',true),
('00000007-d003-d003-d003-000000000001','drv003@blz-operators.fleet',drv_hash,'Hassan Al-Noaimi','viewer','aaaaaaaa-0007-0007-0007-000000000007',true),
('00000007-d004-d004-d004-000000000001','drv004@blz-operators.fleet',drv_hash,'Ali Al-Ansari','viewer','aaaaaaaa-0007-0007-0007-000000000007',true)
ON CONFLICT (email) DO NOTHING;

END $$;

-- ──────────────────────────────────────────────────────────────────────────────
-- 6. DRIVERS
-- ──────────────────────────────────────────────────────────────────────────────

INSERT INTO drivers (id, tenant_id, employee_id, full_name, phone, email, license_number, license_class, license_expiry, status, safety_score, depot_id, user_id) VALUES

-- CloudNext Technologies
('00000001-0001-0001-0001-000000000001','aaaaaaaa-0001-0001-0001-000000000001','CNT-D001','Ahmed Raza','+92-300-1110001','ahmed.raza@cnt.pk','LHR-DL-001','HTV','2027-06-30','active',92,'dddd0001-0001-0001-0001-000000000001','00000001-d001-d001-d001-000000000001'),
('00000001-0001-0001-0001-000000000002','aaaaaaaa-0001-0001-0001-000000000001','CNT-D002','Kamran Iqbal','+92-300-1110002','kamran.iqbal@cnt.pk','LHR-DL-002','LTV','2026-12-31','active',85,'dddd0001-0001-0001-0001-000000000001','00000001-d002-d002-d002-000000000001'),
('00000001-0001-0001-0001-000000000003','aaaaaaaa-0001-0001-0001-000000000001','CNT-D003','Tariq Mehmood','+92-300-1110003','tariq.m@cnt.pk','LHR-DL-003','HTV','2027-03-15','active',78,'dddd0001-0001-0001-0001-000000000002','00000001-d003-d003-d003-000000000001'),
('00000001-0001-0001-0001-000000000004','aaaaaaaa-0001-0001-0001-000000000001','CNT-D004','Nasir Hussain','+92-300-1110004','nasir.h@cnt.pk','LHR-DL-004','PSV','2028-01-20','active',88,'dddd0001-0001-0001-0001-000000000002','00000001-d004-d004-d004-000000000001'),
('00000001-0001-0001-0001-000000000005','aaaaaaaa-0001-0001-0001-000000000001','CNT-D005','Sajjad Ali','+92-300-1110005','sajjad.ali@cnt.pk','LHR-DL-005','LTV','2026-09-10','active',72,'dddd0001-0001-0001-0001-000000000001','00000001-d005-d005-d005-000000000001'),
('00000001-0001-0001-0001-000000000006','aaaaaaaa-0001-0001-0001-000000000001','CNT-D006','Zahid Ullah','+92-300-1110006','zahid.u@cnt.pk','LHR-DL-006','HTV','2027-11-05','inactive',65,'dddd0001-0001-0001-0001-000000000001','00000001-d006-d006-d006-000000000001'),

-- Naqel Express
('00000002-0002-0002-0002-000000000001','aaaaaaaa-0002-0002-0002-000000000002','NQL-D001','Faris Al-Ghamdi','+966-55-2221001','faris@naqel.sa','RYD-DL-001','HTV','2027-08-15','active',95,'dddd0002-0002-0002-0002-000000000001','00000002-d001-d001-d001-000000000001'),
('00000002-0002-0002-0002-000000000002','aaaaaaaa-0002-0002-0002-000000000002','NQL-D002','Saad Al-Qahtani','+966-55-2221002','saad@naqel.sa','RYD-DL-002','HTV','2026-11-30','active',89,'dddd0002-0002-0002-0002-000000000001','00000002-d002-d002-d002-000000000001'),
('00000002-0002-0002-0002-000000000003','aaaaaaaa-0002-0002-0002-000000000002','NQL-D003','Omar Al-Otaibi','+966-55-2221003','omar@naqel.sa','RYD-DL-003','LTV','2027-04-20','active',82,'dddd0002-0002-0002-0002-000000000001','00000002-d003-d003-d003-000000000001'),
('00000002-0002-0002-0002-000000000004','aaaaaaaa-0002-0002-0002-000000000002','NQL-D004','Bandar Al-Harbi','+966-55-2221004','bandar@naqel.sa','RYD-DL-004','HTV','2028-02-10','active',91,'dddd0002-0002-0002-0002-000000000002','00000002-d004-d004-d004-000000000001'),
('00000002-0002-0002-0002-000000000005','aaaaaaaa-0002-0002-0002-000000000002','NQL-D005','Turki Al-Anazi','+966-55-2221005','turki@naqel.sa','RYD-DL-005','LTV','2027-07-18','active',76,'dddd0002-0002-0002-0002-000000000002','00000002-d005-d005-d005-000000000001'),
('00000002-0002-0002-0002-000000000006','aaaaaaaa-0002-0002-0002-000000000002','NQL-D006','Muteb Al-Shehri','+966-55-2221006','muteb@naqel.sa','RYD-DL-006','HTV','2026-10-25','active',84,'dddd0002-0002-0002-0002-000000000002','00000002-d006-d006-d006-000000000001'),

-- ENOC Fleet
('00000003-0003-0003-0003-000000000001','aaaaaaaa-0003-0003-0003-000000000003','ENC-D001','Saeed Al-Mazrouei','+971-50-3331001','saeed@enoc.ae','DXB-DL-001','HTV','2027-09-01','active',93,'dddd0003-0003-0003-0003-000000000001','00000003-d001-d001-d001-000000000001'),
('00000003-0003-0003-0003-000000000002','aaaaaaaa-0003-0003-0003-000000000003','ENC-D002','Khalid Al-Suwaidi','+971-50-3331002','khalid@enoc.ae','DXB-DL-002','HTV','2027-01-15','active',87,'dddd0003-0003-0003-0003-000000000001','00000003-d002-d002-d002-000000000001'),
('00000003-0003-0003-0003-000000000003','aaaaaaaa-0003-0003-0003-000000000003','ENC-D003','Hamad Al-Ameri','+971-50-3331003','hamad@enoc.ae','DXB-DL-003','LTV','2028-05-22','active',79,'dddd0003-0003-0003-0003-000000000001','00000003-d003-d003-d003-000000000001'),
('00000003-0003-0003-0003-000000000004','aaaaaaaa-0003-0003-0003-000000000003','ENC-D004','Yousef Al-Dhaheri','+971-50-3331004','yousef@enoc.ae','DXB-DL-004','PSV','2027-03-30','active',96,'dddd0003-0003-0003-0003-000000000002','00000003-d004-d004-d004-000000000001'),
('00000003-0003-0003-0003-000000000005','aaaaaaaa-0003-0003-0003-000000000003','ENC-D005','Salem Al-Nuaimi','+971-50-3331005','salem@enoc.ae','DXB-DL-005','HTV','2026-12-01','active',81,'dddd0003-0003-0003-0003-000000000002','00000003-d005-d005-d005-000000000001'),
('00000003-0003-0003-0003-000000000006','aaaaaaaa-0003-0003-0003-000000000003','ENC-D006','Rashid Al-Ketbi','+971-50-3331006','rashid@enoc.ae','DXB-DL-006','HTV','2027-06-14','active',88,'dddd0003-0003-0003-0003-000000000002','00000003-d006-d006-d006-000000000001'),

-- Q-Logistics
('00000004-0004-0004-0004-000000000001','aaaaaaaa-0004-0004-0004-000000000004','QLG-D001','Ahmed Al-Hajri','+974-5554-4001','ahmed@qlog.qa','DOH-DL-001','HTV','2027-07-10','active',90,'dddd0004-0004-0004-0004-000000000001','00000004-d001-d001-d001-000000000001'),
('00000004-0004-0004-0004-000000000002','aaaaaaaa-0004-0004-0004-000000000004','QLG-D002','Nasser Al-Sulaiti','+974-5554-4002','nasser@qlog.qa','DOH-DL-002','LTV','2028-01-05','active',83,'dddd0004-0004-0004-0004-000000000001','00000004-d002-d002-d002-000000000001'),
('00000004-0004-0004-0004-000000000003','aaaaaaaa-0004-0004-0004-000000000004','QLG-D003','Khalid Al-Dosari','+974-5554-4003','khalid@qlog.qa','DOH-DL-003','HTV','2027-04-18','active',77,'dddd0004-0004-0004-0004-000000000001','00000004-d003-d003-d003-000000000001'),
('00000004-0004-0004-0004-000000000004','aaaaaaaa-0004-0004-0004-000000000004','QLG-D004','Ibrahim Al-Ansari','+974-5554-4004','ibrahim@qlog.qa','DOH-DL-004','PSV','2026-11-20','active',86,'dddd0004-0004-0004-0004-000000000001','00000004-d004-d004-d004-000000000001'),
('00000004-0004-0004-0004-000000000005','aaaaaaaa-0004-0004-0004-000000000004','QLG-D005','Fahad Al-Buainain','+974-5554-4005','fahad@qlog.qa','DOH-DL-005','HTV','2027-09-25','active',74,'dddd0004-0004-0004-0004-000000000001','00000004-d005-d005-d005-000000000001'),

-- Asyad Group
('00000005-0005-0005-0005-000000000001','aaaaaaaa-0005-0005-0005-000000000005','ASY-D001','Said Al-Kindi','+968-9555-5001','said@asyad.om','MCT-DL-001','HTV','2027-10-12','active',91,'dddd0005-0005-0005-0005-000000000001','00000005-d001-d001-d001-000000000001'),
('00000005-0005-0005-0005-000000000002','aaaaaaaa-0005-0005-0005-000000000005','ASY-D002','Sulaiman Al-Farsi','+968-9555-5002','sulaiman@asyad.om','MCT-DL-002','HTV','2026-08-28','active',84,'dddd0005-0005-0005-0005-000000000001','00000005-d002-d002-d002-000000000001'),
('00000005-0005-0005-0005-000000000003','aaaaaaaa-0005-0005-0005-000000000005','ASY-D003','Majid Al-Habsi','+968-9555-5003','majid@asyad.om','MCT-DL-003','LTV','2028-03-07','active',80,'dddd0005-0005-0005-0005-000000000001','00000005-d003-d003-d003-000000000001'),
('00000005-0005-0005-0005-000000000004','aaaaaaaa-0005-0005-0005-000000000005','ASY-D004','Badr Al-Rashdi','+968-9555-5004','badr@asyad.om','MCT-DL-004','HTV','2027-06-01','active',87,'dddd0005-0005-0005-0005-000000000001','00000005-d004-d004-d004-000000000001'),
('00000005-0005-0005-0005-000000000005','aaaaaaaa-0005-0005-0005-000000000005','ASY-D005','Khalid Al-Zadjali','+968-9555-5005','khalid@asyad.om','MCT-DL-005','PSV','2027-12-20','active',79,'dddd0005-0005-0005-0005-000000000001','00000005-d005-d005-d005-000000000001'),

-- Agility Logistics
('00000006-0006-0006-0006-000000000001','aaaaaaaa-0006-0006-0006-000000000006','AGI-D001','Walid Al-Mutawa','+965-9666-6001','walid@agility.kw','KWT-DL-001','HTV','2027-11-14','active',88,'dddd0006-0006-0006-0006-000000000001','00000006-d001-d001-d001-000000000001'),
('00000006-0006-0006-0006-000000000002','aaaaaaaa-0006-0006-0006-000000000006','AGI-D002','Tariq Al-Fahad','+965-9666-6002','tariq@agility.kw','KWT-DL-002','LTV','2027-02-28','active',82,'dddd0006-0006-0006-0006-000000000001','00000006-d002-d002-d002-000000000001'),
('00000006-0006-0006-0006-000000000003','aaaaaaaa-0006-0006-0006-000000000006','AGI-D003','Salem Al-Enezi','+965-9666-6003','salem@agility.kw','KWT-DL-003','HTV','2028-04-10','active',76,'dddd0006-0006-0006-0006-000000000001','00000006-d003-d003-d003-000000000001'),
('00000006-0006-0006-0006-000000000004','aaaaaaaa-0006-0006-0006-000000000006','AGI-D004','Nasser Al-Rashidi','+965-9666-6004','nasser@agility.kw','KWT-DL-004','HTV','2027-08-05','active',94,'dddd0006-0006-0006-0006-000000000001','00000006-d004-d004-d004-000000000001'),
('00000006-0006-0006-0006-000000000005','aaaaaaaa-0006-0006-0006-000000000006','AGI-D005','Bader Al-Hajri','+965-9666-6005','bader@agility.kw','KWT-DL-005','LTV','2026-10-01','active',70,'dddd0006-0006-0006-0006-000000000001','00000006-d005-d005-d005-000000000001'),

-- BLZ Operators
('00000007-0007-0007-0007-000000000001','aaaaaaaa-0007-0007-0007-000000000007','BLZ-D001','Khalil Al-Rumaihi','+973-3777-7001','khalil@blz.bh','BAH-DL-001','HTV','2027-05-20','active',89,'dddd0007-0007-0007-0007-000000000001','00000007-d001-d001-d001-000000000001'),
('00000007-0007-0007-0007-000000000002','aaaaaaaa-0007-0007-0007-000000000007','BLZ-D002','Yusuf Al-Mannai','+973-3777-7002','yusuf@blz.bh','BAH-DL-002','LTV','2027-01-08','active',83,'dddd0007-0007-0007-0007-000000000001','00000007-d002-d002-d002-000000000001'),
('00000007-0007-0007-0007-000000000003','aaaaaaaa-0007-0007-0007-000000000007','BLZ-D003','Hassan Al-Noaimi','+973-3777-7003','hassan@blz.bh','BAH-DL-003','HTV','2028-07-15','active',75,'dddd0007-0007-0007-0007-000000000001','00000007-d003-d003-d003-000000000001'),
('00000007-0007-0007-0007-000000000004','aaaaaaaa-0007-0007-0007-000000000007','BLZ-D004','Ali Al-Ansari','+973-3777-7004','ali@blz.bh','BAH-DL-004','PSV','2027-09-30','active',92,'dddd0007-0007-0007-0007-000000000001','00000007-d004-d004-d004-000000000001');

-- ──────────────────────────────────────────────────────────────────────────────
-- 7. VEHICLES  (6 per tenant, QR codes, initial GPS positions)
-- ──────────────────────────────────────────────────────────────────────────────

INSERT INTO vehicles (id, tenant_id, registration, make, model, year, type, color, fuel_capacity, fuel_type, max_speed, status, current_location, current_fuel, health_score, depot_id, assigned_driver_id, route_id, qr_code, insurance_expiry, registration_expiry) VALUES

-- ── CloudNext Technologies (Lahore) ──
('00000001-0001-0001-0001-000000000001','aaaaaaaa-0001-0001-0001-000000000001','CNT-001','Isuzu','NPR',2022,'truck','White',80,'diesel',120,'active',ST_SetSRID(ST_MakePoint(74.358,31.517),4326),75,88,'dddd0001-0001-0001-0001-000000000001','00000001-0001-0001-0001-000000000001','00000001-0001-0001-0001-000000000001','cloudnext://bus/00000001-0001-0001-0001-000000000001','2026-12-31','2026-06-30'),
('00000001-0001-0001-0001-000000000002','aaaaaaaa-0001-0001-0001-000000000001','CNT-002','Toyota','Hilux',2021,'van','Silver',60,'petrol',140,'active',ST_SetSRID(ST_MakePoint(74.370,31.515),4326),62,92,'dddd0001-0001-0001-0001-000000000001','00000001-0001-0001-0001-000000000002','00000001-0001-0001-0001-000000000002','cloudnext://bus/00000001-0001-0001-0001-000000000002','2027-03-15','2027-01-31'),
('00000001-0001-0001-0001-000000000003','aaaaaaaa-0001-0001-0001-000000000001','CNT-003','Hino','300',2023,'truck','Blue',100,'diesel',110,'idle',ST_SetSRID(ST_MakePoint(74.340,31.490),4326),45,79,'dddd0001-0001-0001-0001-000000000002','00000001-0001-0001-0001-000000000003','00000001-0001-0001-0001-000000000003','cloudnext://bus/00000001-0001-0001-0001-000000000003','2026-09-01','2026-09-01'),
('00000001-0001-0001-0001-000000000004','aaaaaaaa-0001-0001-0001-000000000001','CNT-004','Toyota','Coaster',2022,'bus','White',90,'diesel',100,'active',ST_SetSRID(ST_MakePoint(74.380,31.550),4326),81,85,'dddd0001-0001-0001-0001-000000000001','00000001-0001-0001-0001-000000000004','00000001-0001-0001-0001-000000000004','cloudnext://bus/00000001-0001-0001-0001-000000000004','2027-06-30','2027-06-30'),
('00000001-0001-0001-0001-000000000005','aaaaaaaa-0001-0001-0001-000000000001','CNT-005','Honda','CB150',2023,'motorcycle','Red',15,'petrol',160,'active',ST_SetSRID(ST_MakePoint(74.410,31.460),4326),88,95,'dddd0001-0001-0001-0001-000000000002','00000001-0001-0001-0001-000000000005','00000001-0001-0001-0001-000000000005','cloudnext://bus/00000001-0001-0001-0001-000000000005','2027-12-01','2027-12-01'),
('00000001-0001-0001-0001-000000000006','aaaaaaaa-0001-0001-0001-000000000001','CNT-006','Isuzu','FVR',2020,'heavy',NULL,200,'diesel',90,'maintenance',ST_SetSRID(ST_MakePoint(74.320,31.470),4326),30,55,'dddd0001-0001-0001-0001-000000000001',NULL,NULL,'cloudnext://bus/00000001-0001-0001-0001-000000000006','2025-11-30','2025-11-30'),

-- ── Naqel Express (Riyadh) ──
('00000002-0002-0002-0002-000000000001','aaaaaaaa-0002-0002-0002-000000000002','NQL-001','Mercedes-Benz','Actros',2023,'heavy','White',400,'diesel',120,'active',ST_SetSRID(ST_MakePoint(46.673,24.710),4326),70,91,'dddd0002-0002-0002-0002-000000000001','00000002-0002-0002-0002-000000000001','00000002-0002-0002-0002-000000000001','cloudnext://bus/00000002-0002-0002-0002-000000000001','2027-08-31','2027-08-31'),
('00000002-0002-0002-0002-000000000002','aaaaaaaa-0002-0002-0002-000000000002','NQL-002','Scania','R500',2022,'heavy','Red',350,'diesel',130,'active',ST_SetSRID(ST_MakePoint(46.700,24.770),4326),55,87,'dddd0002-0002-0002-0002-000000000001','00000002-0002-0002-0002-000000000002','00000002-0002-0002-0002-000000000002','cloudnext://bus/00000002-0002-0002-0002-000000000002','2027-05-15','2027-05-15'),
('00000002-0002-0002-0002-000000000003','aaaaaaaa-0002-0002-0002-000000000002','NQL-003','Volvo','FH16',2021,'heavy','Blue',380,'diesel',125,'idle',ST_SetSRID(ST_MakePoint(46.682,24.693),4326),83,82,'dddd0002-0002-0002-0002-000000000001','00000002-0002-0002-0002-000000000003','00000002-0002-0002-0002-000000000003','cloudnext://bus/00000002-0002-0002-0002-000000000003','2026-11-30','2026-11-30'),
('00000002-0002-0002-0002-000000000004','aaaaaaaa-0002-0002-0002-000000000002','NQL-004','Isuzu','FVZ',2023,'truck','Grey',150,'diesel',100,'active',ST_SetSRID(ST_MakePoint(46.820,24.650),4326),66,90,'dddd0002-0002-0002-0002-000000000002','00000002-0002-0002-0002-000000000004','00000002-0002-0002-0002-000000000004','cloudnext://bus/00000002-0002-0002-0002-000000000004','2028-02-28','2028-02-28'),
('00000002-0002-0002-0002-000000000005','aaaaaaaa-0002-0002-0002-000000000002','NQL-005','Toyota','Land Cruiser',2022,'car','White',90,'petrol',180,'active',ST_SetSRID(ST_MakePoint(46.698,24.810),4326),72,94,'dddd0002-0002-0002-0002-000000000002','00000002-0002-0002-0002-000000000005','00000002-0002-0002-0002-000000000005','cloudnext://bus/00000002-0002-0002-0002-000000000005','2027-07-31','2027-07-31'),
('00000002-0002-0002-0002-000000000006','aaaaaaaa-0002-0002-0002-000000000002','NQL-006','Ford','Transit',2021,'van','White',70,'diesel',140,'idle',ST_SetSRID(ST_MakePoint(46.660,24.675),4326),40,76,'dddd0002-0002-0002-0002-000000000002','00000002-0002-0002-0002-000000000006','00000002-0002-0002-0002-000000000006','cloudnext://bus/00000002-0002-0002-0002-000000000006','2026-10-31','2026-10-31'),

-- ── ENOC Fleet (Dubai) ──
('00000003-0003-0003-0003-000000000001','aaaaaaaa-0003-0003-0003-000000000003','ENC-001','Toyota','Land Cruiser',2023,'car','White',90,'petrol',180,'active',ST_SetSRID(ST_MakePoint(55.140,25.090),4326),78,93,'dddd0003-0003-0003-0003-000000000001','00000003-0003-0003-0003-000000000001','00000003-0003-0003-0003-000000000001','cloudnext://bus/00000003-0003-0003-0003-000000000001','2027-09-30','2027-09-30'),
('00000003-0003-0003-0003-000000000002','aaaaaaaa-0003-0003-0003-000000000003','ENC-002','Isuzu','NQR',2022,'truck','Red',120,'diesel',110,'active',ST_SetSRID(ST_MakePoint(55.200,25.100),4326),61,86,'dddd0003-0003-0003-0003-000000000001','00000003-0003-0003-0003-000000000002','00000003-0003-0003-0003-000000000002','cloudnext://bus/00000003-0003-0003-0003-000000000002','2027-01-31','2027-01-31'),
('00000003-0003-0003-0003-000000000003','aaaaaaaa-0003-0003-0003-000000000003','ENC-003','Nissan','Patrol',2023,'car','Silver',80,'petrol',200,'idle',ST_SetSRID(ST_MakePoint(55.020,24.990),4326),92,97,'dddd0003-0003-0003-0003-000000000001','00000003-0003-0003-0003-000000000003','00000003-0003-0003-0003-000000000003','cloudnext://bus/00000003-0003-0003-0003-000000000003','2028-05-31','2028-05-31'),
('00000003-0003-0003-0003-000000000004','aaaaaaaa-0003-0003-0003-000000000003','ENC-004','Toyota','Coaster',2021,'bus','White',100,'diesel',100,'active',ST_SetSRID(ST_MakePoint(55.310,25.240),4326),53,80,'dddd0003-0003-0003-0003-000000000002','00000003-0003-0003-0003-000000000004','00000003-0003-0003-0003-000000000004','cloudnext://bus/00000003-0003-0003-0003-000000000004','2027-03-31','2027-03-31'),
('00000003-0003-0003-0003-000000000005','aaaaaaaa-0003-0003-0003-000000000003','ENC-005','Volvo','FH',2022,'heavy','Blue',350,'diesel',130,'active',ST_SetSRID(ST_MakePoint(55.350,25.150),4326),67,84,'dddd0003-0003-0003-0003-000000000002','00000003-0003-0003-0003-000000000005','00000003-0003-0003-0003-000000000005','cloudnext://bus/00000003-0003-0003-0003-000000000005','2026-12-31','2026-12-31'),
('00000003-0003-0003-0003-000000000006','aaaaaaaa-0003-0003-0003-000000000003','ENC-006','Ford','F-250',2022,'truck','Black',90,'diesel',150,'idle',ST_SetSRID(ST_MakePoint(55.200,24.980),4326),45,89,'dddd0003-0003-0003-0003-000000000002','00000003-0003-0003-0003-000000000006','00000003-0003-0003-0003-000000000006','cloudnext://bus/00000003-0003-0003-0003-000000000006','2027-06-30','2027-06-30'),

-- ── Q-Logistics (Doha) ──
('00000004-0004-0004-0004-000000000001','aaaaaaaa-0004-0004-0004-000000000004','QLG-001','Mitsubishi','Canter',2022,'truck','White',80,'diesel',110,'active',ST_SetSRID(ST_MakePoint(51.520,25.290),4326),74,88,'dddd0004-0004-0004-0004-000000000001','00000004-0004-0004-0004-000000000001','00000004-0004-0004-0004-000000000001','cloudnext://bus/00000004-0004-0004-0004-000000000001','2027-07-31','2027-07-31'),
('00000004-0004-0004-0004-000000000002','aaaaaaaa-0004-0004-0004-000000000004','QLG-002','Toyota','Land Cruiser',2023,'car','White',90,'petrol',180,'active',ST_SetSRID(ST_MakePoint(51.470,25.250),4326),83,95,'dddd0004-0004-0004-0004-000000000001','00000004-0004-0004-0004-000000000002','00000004-0004-0004-0004-000000000002','cloudnext://bus/00000004-0004-0004-0004-000000000002','2028-01-31','2028-01-31'),
('00000004-0004-0004-0004-000000000003','aaaaaaaa-0004-0004-0004-000000000004','QLG-003','Hino','500',2021,'heavy',NULL,200,'diesel',100,'idle',ST_SetSRID(ST_MakePoint(51.540,25.170),4326),49,77,'dddd0004-0004-0004-0004-000000000001','00000004-0004-0004-0004-000000000003','00000004-0004-0004-0004-000000000003','cloudnext://bus/00000004-0004-0004-0004-000000000003','2027-04-30','2027-04-30'),
('00000004-0004-0004-0004-000000000004','aaaaaaaa-0004-0004-0004-000000000004','QLG-004','Nissan','Urvan',2022,'van','Silver',70,'petrol',140,'active',ST_SetSRID(ST_MakePoint(51.557,25.260),4326),68,83,'dddd0004-0004-0004-0004-000000000001','00000004-0004-0004-0004-000000000004','00000004-0004-0004-0004-000000000004','cloudnext://bus/00000004-0004-0004-0004-000000000004','2026-11-30','2026-11-30'),
('00000004-0004-0004-0004-000000000005','aaaaaaaa-0004-0004-0004-000000000004','QLG-005','Isuzu','FTR',2023,'truck','Blue',150,'diesel',105,'active',ST_SetSRID(ST_MakePoint(51.460,25.230),4326),71,90,'dddd0004-0004-0004-0004-000000000001','00000004-0004-0004-0004-000000000005','00000004-0004-0004-0004-000000000005','cloudnext://bus/00000004-0004-0004-0004-000000000005','2027-09-30','2027-09-30'),

-- ── Asyad Group (Muscat) ──
('00000005-0005-0005-0005-000000000001','aaaaaaaa-0005-0005-0005-000000000005','ASY-001','Volvo','FMX',2022,'heavy','Orange',400,'diesel',120,'active',ST_SetSRID(ST_MakePoint(58.480,23.580),4326),76,89,'dddd0005-0005-0005-0005-000000000001','00000005-0005-0005-0005-000000000001','00000005-0005-0005-0005-000000000001','cloudnext://bus/00000005-0005-0005-0005-000000000001','2027-10-31','2027-10-31'),
('00000005-0005-0005-0005-000000000002','aaaaaaaa-0005-0005-0005-000000000005','ASY-002','Scania','P360',2021,'truck','White',180,'diesel',115,'active',ST_SetSRID(ST_MakePoint(58.400,23.640),4326),58,84,'dddd0005-0005-0005-0005-000000000001','00000005-0005-0005-0005-000000000002','00000005-0005-0005-0005-000000000002','cloudnext://bus/00000005-0005-0005-0005-000000000002','2026-08-31','2026-08-31'),
('00000005-0005-0005-0005-000000000003','aaaaaaaa-0005-0005-0005-000000000005','ASY-003','Toyota','Coaster',2023,'bus','White',100,'diesel',100,'idle',ST_SetSRID(ST_MakePoint(58.590,23.620),4326),87,91,'dddd0005-0005-0005-0005-000000000001','00000005-0005-0005-0005-000000000003','00000005-0005-0005-0005-000000000003','cloudnext://bus/00000005-0005-0005-0005-000000000003','2028-03-31','2028-03-31'),
('00000005-0005-0005-0005-000000000004','aaaaaaaa-0005-0005-0005-000000000005','ASY-004','Isuzu','NPR',2022,'truck','Grey',80,'diesel',110,'active',ST_SetSRID(ST_MakePoint(58.270,23.580),4326),64,79,'dddd0005-0005-0005-0005-000000000001','00000005-0005-0005-0005-000000000004','00000005-0005-0005-0005-000000000004','cloudnext://bus/00000005-0005-0005-0005-000000000004','2027-06-30','2027-06-30'),
('00000005-0005-0005-0005-000000000005','aaaaaaaa-0005-0005-0005-000000000005','ASY-005','Caterpillar','950H',2020,'heavy','Yellow',500,'diesel',50,'maintenance',ST_SetSRID(ST_MakePoint(58.170,23.560),4326),25,60,'dddd0005-0005-0005-0005-000000000001',NULL,NULL,'cloudnext://bus/00000005-0005-0005-0005-000000000005','2025-12-31','2025-12-31'),

-- ── Agility Logistics (Kuwait) ──
('00000006-0006-0006-0006-000000000001','aaaaaaaa-0006-0006-0006-000000000006','AGI-001','Mercedes-Benz','Sprinter',2022,'van','White',80,'diesel',140,'active',ST_SetSRID(ST_MakePoint(47.950,29.350),4326),72,90,'dddd0006-0006-0006-0006-000000000001','00000006-0006-0006-0006-000000000001','00000006-0006-0006-0006-000000000001','cloudnext://bus/00000006-0006-0006-0006-000000000001','2027-11-30','2027-11-30'),
('00000006-0006-0006-0006-000000000002','aaaaaaaa-0006-0006-0006-000000000006','AGI-002','Isuzu','NPR',2023,'truck','Blue',80,'diesel',110,'active',ST_SetSRID(ST_MakePoint(48.030,29.280),4326),60,85,'dddd0006-0006-0006-0006-000000000001','00000006-0006-0006-0006-000000000002','00000006-0006-0006-0006-000000000002','cloudnext://bus/00000006-0006-0006-0006-000000000002','2027-02-28','2027-02-28'),
('00000006-0006-0006-0006-000000000003','aaaaaaaa-0006-0006-0006-000000000006','AGI-003','Toyota','Land Cruiser',2022,'car','White',90,'petrol',180,'idle',ST_SetSRID(ST_MakePoint(47.960,29.260),4326),88,94,'dddd0006-0006-0006-0006-000000000001','00000006-0006-0006-0006-000000000003','00000006-0006-0006-0006-000000000003','cloudnext://bus/00000006-0006-0006-0006-000000000003','2028-04-30','2028-04-30'),
('00000006-0006-0006-0006-000000000004','aaaaaaaa-0006-0006-0006-000000000006','AGI-004','Scania','G410',2021,'heavy','Red',350,'diesel',125,'active',ST_SetSRID(ST_MakePoint(47.930,29.370),4326),55,82,'dddd0006-0006-0006-0006-000000000001','00000006-0006-0006-0006-000000000004','00000006-0006-0006-0006-000000000004','cloudnext://bus/00000006-0006-0006-0006-000000000004','2027-08-31','2027-08-31'),
('00000006-0006-0006-0006-000000000005','aaaaaaaa-0006-0006-0006-000000000006','AGI-005','Nissan','Urvan',2022,'van','Silver',70,'petrol',140,'active',ST_SetSRID(ST_MakePoint(47.900,29.330),4326),41,73,'dddd0006-0006-0006-0006-000000000001','00000006-0006-0006-0006-000000000005','00000006-0006-0006-0006-000000000005','cloudnext://bus/00000006-0006-0006-0006-000000000005','2026-10-31','2026-10-31'),

-- ── BLZ Operators (Bahrain) ──
('00000007-0007-0007-0007-000000000001','aaaaaaaa-0007-0007-0007-000000000007','BLZ-001','Toyota','Coaster',2022,'bus','White',100,'diesel',100,'active',ST_SetSRID(ST_MakePoint(50.480,26.190),4326),79,88,'dddd0007-0007-0007-0007-000000000001','00000007-0007-0007-0007-000000000001','00000007-0007-0007-0007-000000000001','cloudnext://bus/00000007-0007-0007-0007-000000000001','2027-05-31','2027-05-31'),
('00000007-0007-0007-0007-000000000002','aaaaaaaa-0007-0007-0007-000000000007','BLZ-002','Mitsubishi','Fuso',2021,'truck','White',120,'diesel',105,'active',ST_SetSRID(ST_MakePoint(50.570,26.220),4326),63,83,'dddd0007-0007-0007-0007-000000000001','00000007-0007-0007-0007-000000000002','00000007-0007-0007-0007-000000000002','cloudnext://bus/00000007-0007-0007-0007-000000000002','2027-01-31','2027-01-31'),
('00000007-0007-0007-0007-000000000003','aaaaaaaa-0007-0007-0007-000000000007','BLZ-003','Isuzu','NPR',2023,'truck','Grey',80,'diesel',110,'idle',ST_SetSRID(ST_MakePoint(50.620,26.210),4326),86,90,'dddd0007-0007-0007-0007-000000000001','00000007-0007-0007-0007-000000000003','00000007-0007-0007-0007-000000000003','cloudnext://bus/00000007-0007-0007-0007-000000000003','2028-07-31','2028-07-31'),
('00000007-0007-0007-0007-000000000004','aaaaaaaa-0007-0007-0007-000000000007','BLZ-004','Ford','Transit',2022,'van','Blue',70,'diesel',140,'active',ST_SetSRID(ST_MakePoint(50.650,26.220),4326),57,75,'dddd0007-0007-0007-0007-000000000001','00000007-0007-0007-0007-000000000004','00000007-0007-0007-0007-000000000004','cloudnext://bus/00000007-0007-0007-0007-000000000004','2027-09-30','2027-09-30');

-- ──────────────────────────────────────────────────────────────────────────────
-- 8. GEOFENCES (2 per tenant)
-- ──────────────────────────────────────────────────────────────────────────────

INSERT INTO geofences (tenant_id, name, description, color, zone_type, boundary, is_active, alert_on_enter, alert_on_exit, speed_limit) VALUES

('aaaaaaaa-0001-0001-0001-000000000001','CNT Main Hub Zone','Lahore HQ geofence','#00d4e8','depot',
 ST_SetSRID(ST_GeomFromText('POLYGON((74.355 31.515, 74.365 31.515, 74.365 31.522, 74.355 31.522, 74.355 31.515))'),4326),
 true,true,true,20),
('aaaaaaaa-0001-0001-0001-000000000001','DHA Restricted Zone','DHA Phase 5 restricted area','#ef4444','restricted',
 ST_SetSRID(ST_GeomFromText('POLYGON((74.405 31.466, 74.415 31.466, 74.415 31.474, 74.405 31.474, 74.405 31.466))'),4326),
 true,true,true,30),

('aaaaaaaa-0002-0002-0002-000000000002','Riyadh Central Hub','Main depot geofence','#00d4e8','depot',
 ST_SetSRID(ST_GeomFromText('POLYGON((46.668 24.706, 46.680 24.706, 46.680 24.715, 46.668 24.715, 46.668 24.706))'),4326),
 true,true,true,15),
('aaaaaaaa-0002-0002-0002-000000000002','King Fahd Speed Zone','Highway speed enforcement','#f59e0b','route',
 ST_SetSRID(ST_GeomFromText('POLYGON((46.700 24.685, 46.730 24.685, 46.730 24.700, 46.700 24.700, 46.700 24.685))'),4326),
 true,false,false,80),

('aaaaaaaa-0003-0003-0003-000000000003','Dubai Main Terminal','ENOC depot zone','#00d4e8','depot',
 ST_SetSRID(ST_GeomFromText('POLYGON((55.195 25.145, 55.210 25.145, 55.210 25.158, 55.195 25.158, 55.195 25.145))'),4326),
 true,true,true,10),
('aaaaaaaa-0003-0003-0003-000000000003','Jebel Ali Port Restricted','Port security zone','#ef4444','restricted',
 ST_SetSRID(ST_GeomFromText('POLYGON((55.010 24.984, 55.035 24.984, 55.035 24.998, 55.010 24.998, 55.010 24.984))'),4326),
 true,true,true,20),

('aaaaaaaa-0004-0004-0004-000000000004','Doha Industrial Zone','Q-Log main depot','#00d4e8','depot',
 ST_SetSRID(ST_GeomFromText('POLYGON((51.484 25.244, 51.498 25.244, 51.498 25.258, 51.484 25.258, 51.484 25.244))'),4326),
 true,true,true,15),
('aaaaaaaa-0004-0004-0004-000000000004','Hamad Port Security','Port restricted zone','#ef4444','restricted',
 ST_SetSRID(ST_GeomFromText('POLYGON((51.524 25.132, 51.545 25.132, 51.545 25.148, 51.524 25.148, 51.524 25.132))'),4326),
 true,true,true,20),

('aaaaaaaa-0005-0005-0005-000000000005','Muscat Port Depot','Asyad main depot','#00d4e8','depot',
 ST_SetSRID(ST_GeomFromText('POLYGON((58.582 23.613, 58.600 23.613, 58.600 23.628, 58.582 23.628, 58.582 23.613))'),4326),
 true,true,true,10),
('aaaaaaaa-0005-0005-0005-000000000005','Rusayl Industrial Area','Industrial zone boundary','#f59e0b','delivery',
 ST_SetSRID(ST_GeomFromText('POLYGON((58.142 23.542, 58.200 23.542, 58.200 23.580, 58.142 23.580, 58.142 23.542))'),4326),
 true,true,false,40),

('aaaaaaaa-0006-0006-0006-000000000006','Shuwaikh Port Zone','Agility port depot','#00d4e8','depot',
 ST_SetSRID(ST_GeomFromText('POLYGON((47.915 29.352, 47.945 29.352, 47.945 29.370, 47.915 29.370, 47.915 29.352))'),4326),
 true,true,true,15),
('aaaaaaaa-0006-0006-0006-000000000006','Fahaheel Industrial','South Kuwait zone','#a3e635','delivery',
 ST_SetSRID(ST_GeomFromText('POLYGON((47.970 29.270, 48.020 29.270, 48.020 29.300, 47.970 29.300, 47.970 29.270))'),4326),
 true,false,true,60),

('aaaaaaaa-0007-0007-0007-000000000007','Hidd Industrial Base','BLZ main yard','#00d4e8','depot',
 ST_SetSRID(ST_GeomFromText('POLYGON((50.622 26.203, 50.640 26.203, 50.640 26.218, 50.622 26.218, 50.622 26.203))'),4326),
 true,true,true,10),
('aaaaaaaa-0007-0007-0007-000000000007','Port Security Zone','Khalifa Port restricted','#ef4444','restricted',
 ST_SetSRID(ST_GeomFromText('POLYGON((50.592 26.192, 50.612 26.192, 50.612 26.208, 50.592 26.208, 50.592 26.192))'),4326),
 true,true,true,15);

-- ──────────────────────────────────────────────────────────────────────────────
-- 9. SAMPLE TELEMETRY (initial GPS fix for each active vehicle)
-- ──────────────────────────────────────────────────────────────────────────────

INSERT INTO telemetry (vehicle_id, recorded_at, location, speed, heading, fuel_level, engine_on)
SELECT v.id,
       NOW() - (random() * INTERVAL '5 minutes'),
       v.current_location,
       v.current_fuel * 0.8,
       (random() * 360)::NUMERIC(6,2),
       v.current_fuel,
       v.status = 'active'
FROM vehicles v
WHERE v.tenant_id IN (
  'aaaaaaaa-0001-0001-0001-000000000001','aaaaaaaa-0002-0002-0002-000000000002',
  'aaaaaaaa-0003-0003-0003-000000000003','aaaaaaaa-0004-0004-0004-000000000004',
  'aaaaaaaa-0005-0005-0005-000000000005','aaaaaaaa-0006-0006-0006-000000000006',
  'aaaaaaaa-0007-0007-0007-000000000007'
)
AND v.current_location IS NOT NULL;

-- ──────────────────────────────────────────────────────────────────────────────
-- 10. SAMPLE ALERTS
-- ──────────────────────────────────────────────────────────────────────────────

INSERT INTO alerts (tenant_id, vehicle_id, type, severity, title, message, location, occurred_at, is_read)
SELECT 
  v.tenant_id, 
  v.id,
  -- Cast the result of the array selection to alert_type
  (ARRAY['speeding','low_fuel','harsh_braking','geofence_exit','offline'])[ceil(random()*5)::int]::alert_type,
  -- Cast this to your severity enum (usually named alert_severity or similar)
  (ARRAY['warning','warning','critical','info','warning'])[ceil(random()*5)::int]::alert_severity,
  (ARRAY['Speed Limit Exceeded','Low Fuel Warning','Harsh Braking','Geofence Exit','Signal Lost'])[ceil(random()*5)::int],
  v.registration || ' — automated alert',
  v.current_location,
  NOW() - (random() * INTERVAL '2 hours'),
  false
FROM vehicles v
WHERE v.tenant_id IN (
  'aaaaaaaa-0001-0001-0001-000000000001','aaaaaaaa-0002-0002-0002-000000000002',
  'aaaaaaaa-0003-0003-0003-000000000003','aaaaaaaa-0004-0004-0004-000000000004',
  'aaaaaaaa-0005-0005-0005-000000000005','aaaaaaaa-0006-0006-0006-000000000006',
  'aaaaaaaa-0007-0007-0007-000000000007'
)
AND v.status = 'active';

-- ──────────────────────────────────────────────────────────────────────────────
-- 11. SAMPLE MAINTENANCE RECORDS
-- ──────────────────────────────────────────────────────────────────────────────

INSERT INTO maintenance (tenant_id, vehicle_id, type, description, status, priority, scheduled_date, cost, currency, workshop)
VALUES
('aaaaaaaa-0001-0001-0001-000000000001','00000001-0001-0001-0001-000000000006','full_service','Major overhaul — engine + brakes','in_progress','high','2026-04-05',450000,'PKR','Premier Auto Workshop'),
('aaaaaaaa-0002-0002-0002-000000000002','00000002-0002-0002-0002-000000000001','oil_change','15,000km oil & filter service','scheduled','normal','2026-04-10',1200,'SAR','Riyadh Fleet Services'),
('aaaaaaaa-0003-0003-0003-000000000003','00000003-0003-0003-0003-000000000002','tire_rotation','Front axle tire rotation','scheduled','low','2026-04-15',800,'AED','Dubai Motor Works'),
('aaaaaaaa-0004-0004-0004-000000000004','00000004-0004-0004-0004-000000000003','brake_service','Full brake overhaul','scheduled','high','2026-04-08',2200,'QAR','Doha Fleet Center'),
('aaaaaaaa-0005-0005-0005-000000000005','00000005-0005-0005-0005-000000000005','full_service','Major mechanical overhaul','in_progress','critical','2026-04-01',3500,'OMR','Muscat Heavy Equipment'),
('aaaaaaaa-0006-0006-0006-000000000006','00000006-0006-0006-0006-000000000002','inspection','Annual regulatory inspection','scheduled','normal','2026-04-20',300,'KWD','Kuwait Vehicle Testing'),
('aaaaaaaa-0007-0007-0007-000000000007','00000007-0007-0007-0007-000000000002','oil_change','Routine oil service','completed','low','2026-03-15',180,'BHD','Hidd Garage');

-- ──────────────────────────────────────────────────────────────────────────────
-- 12. DRIVER SAFETY SCORES
-- ──────────────────────────────────────────────────────────────────────────────

INSERT INTO driver_scores (tenant_id, driver_id, period_date, period_type, overall_score, speed_score, braking_score, cornering_score, fuel_score, distance_km, driving_hours)
SELECT
  d.tenant_id, d.id,
  CURRENT_DATE - (n || ' days')::INTERVAL,
  'daily',
  ROUND((d.safety_score + (random()*10 - 5))::NUMERIC, 2),
  ROUND((d.safety_score + (random()*8 - 4))::NUMERIC, 2),
  ROUND((d.safety_score + (random()*8 - 4))::NUMERIC, 2),
  ROUND((d.safety_score + (random()*6 - 3))::NUMERIC, 2),
  ROUND((d.safety_score + (random()*6 - 3))::NUMERIC, 2),
  ROUND((80 + random()*120)::NUMERIC, 2),
  ROUND((4 + random()*6)::NUMERIC, 2)
FROM drivers d
CROSS JOIN generate_series(0, 6) AS n
WHERE d.tenant_id IN (
  'aaaaaaaa-0001-0001-0001-000000000001','aaaaaaaa-0002-0002-0002-000000000002',
  'aaaaaaaa-0003-0003-0003-000000000003','aaaaaaaa-0004-0004-0004-000000000004',
  'aaaaaaaa-0005-0005-0005-000000000005','aaaaaaaa-0006-0006-0006-000000000006',
  'aaaaaaaa-0007-0007-0007-000000000007'
)
ON CONFLICT (driver_id, period_date, period_type) DO NOTHING;

COMMIT;

-- ──────────────────────────────────────────────────────────────────────────────
-- VERIFICATION
-- ──────────────────────────────────────────────────────────────────────────────

SELECT t.name AS tenant, t.slug,
  (SELECT COUNT(*) FROM users    WHERE tenant_id=t.id AND role NOT IN ('superadmin'))  AS users,
  (SELECT COUNT(*) FROM depots   WHERE tenant_id=t.id) AS depots,
  (SELECT COUNT(*) FROM drivers  WHERE tenant_id=t.id) AS drivers,
  (SELECT COUNT(*) FROM vehicles WHERE tenant_id=t.id) AS vehicles,
  (SELECT COUNT(*) FROM routes   WHERE tenant_id=t.id) AS routes,
  (SELECT COUNT(*) FROM geofences WHERE tenant_id=t.id) AS geofences
FROM tenants t
WHERE t.slug IN ('cloudnext-technologies','naqel-express','enoc-fleet','q-logistics','asyad-group','agility-logistics','blz-operators')
ORDER BY t.name;

DO $$ BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== Seed Complete — Login Credentials ===';
  RAISE NOTICE 'Superadmin: superadmin@cloudnext.solutions / password';
  RAISE NOTICE '';
  RAISE NOTICE 'All tenant users — password: Fleet@2026';
  RAISE NOTICE '  admin@cloudnext-technologies.fleet';
  RAISE NOTICE '  admin@naqel-express.fleet';
  RAISE NOTICE '  admin@enoc-fleet.fleet';
  RAISE NOTICE '  admin@q-logistics.fleet';
  RAISE NOTICE '  admin@asyad-group.fleet';
  RAISE NOTICE '  admin@agility-logistics.fleet';
  RAISE NOTICE '  admin@blz-operators.fleet';
  RAISE NOTICE '';
  RAISE NOTICE 'All drivers — password: Fleet@2026';
  RAISE NOTICE '  drv001@<tenant-slug>.fleet ... drv00N@<tenant-slug>.fleet';
  RAISE NOTICE '==========================================';
END $$;
