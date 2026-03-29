-- ============================================================
--  CloudNext Fleet Management System
--  Complete SQL Bootstrap Script
--  PostgreSQL 16 + PostGIS 3.4
--
--  Usage:
--    psql -U postgres -c "CREATE DATABASE fleet_db;"
--    psql -U postgres -d fleet_db -f fleet_complete.sql
--
--  Includes:
--    1. Extensions
--    2. Enums
--    3. Tables + PostGIS geometry columns
--    4. Indexes (B-Tree + GIST spatial)
--    5. Triggers + Functions
--    6. Spatial Views
--    7. Test Data (depots, drivers, vehicles, geofences,
--                  telemetry, trips, alerts, maintenance,
--                  driver scores, users)
--    8. Verification queries
-- ============================================================


DO $$ BEGIN RAISE NOTICE '======================================================'; END $$;
DO $$ BEGIN RAISE NOTICE '  CloudNext Fleet DB Bootstrap'; END $$;
DO $$ BEGIN RAISE NOTICE '======================================================'; END $$;


-- ──────────────────────────────────────────────────────────
-- 0. SAFETY: drop everything cleanly on re-run
-- ──────────────────────────────────────────────────────────

DO $$ BEGIN RAISE NOTICE '[0] Dropping existing objects (clean re-run)...'; END $$;

DROP VIEW  IF EXISTS v_fleet_live             CASCADE;
DROP VIEW  IF EXISTS v_geofence_violations     CASCADE;
DROP VIEW  IF EXISTS v_trip_summary            CASCADE;
DROP VIEW  IF EXISTS v_driver_leaderboard      CASCADE;
DROP VIEW  IF EXISTS v_vehicle_health          CASCADE;
DROP VIEW  IF EXISTS v_daily_fleet_stats       CASCADE;

DROP FUNCTION IF EXISTS get_vehicle_geofences(UUID)             CASCADE;
DROP FUNCTION IF EXISTS vehicles_near_point(FLOAT, FLOAT, FLOAT) CASCADE;
DROP FUNCTION IF EXISTS update_updated_at()                      CASCADE;
DROP FUNCTION IF EXISTS compute_driver_score(UUID, DATE)         CASCADE;
DROP FUNCTION IF EXISTS fleet_kpi_snapshot()                     CASCADE;

DROP TABLE IF EXISTS driver_scores    CASCADE;
DROP TABLE IF EXISTS maintenance      CASCADE;
DROP TABLE IF EXISTS alerts           CASCADE;
DROP TABLE IF EXISTS geofences        CASCADE;
DROP TABLE IF EXISTS trips            CASCADE;
DROP TABLE IF EXISTS telemetry        CASCADE;
DROP TABLE IF EXISTS vehicles         CASCADE;
DROP TABLE IF EXISTS drivers          CASCADE;
DROP TABLE IF EXISTS depots           CASCADE;
DROP TABLE IF EXISTS users            CASCADE;

DROP TYPE IF EXISTS vehicle_status  CASCADE;
DROP TYPE IF EXISTS vehicle_type    CASCADE;
DROP TYPE IF EXISTS alert_severity  CASCADE;
DROP TYPE IF EXISTS alert_type      CASCADE;
DROP TYPE IF EXISTS driver_status   CASCADE;
DROP TYPE IF EXISTS trip_status     CASCADE;
DROP TYPE IF EXISTS maintenance_type CASCADE;

DO $$ BEGIN RAISE NOTICE '    [OK] clean'; END $$;

-- ──────────────────────────────────────────────────────────
-- 1. EXTENSIONS
-- ──────────────────────────────────────────────────────────

DO $$ BEGIN RAISE NOTICE '[1] Installing extensions...'; END $$;

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;      -- fuzzy text search
CREATE EXTENSION IF NOT EXISTS btree_gist;   -- combined btree+gist indexes

DO $$ BEGIN RAISE NOTICE 'Extensions installed (PostGIS ready)'; END $$;

-- ──────────────────────────────────────────────────────────
-- 2. ENUMS
-- ──────────────────────────────────────────────────────────

DO $$ BEGIN RAISE NOTICE '[2] Creating enums...'; END $$;

CREATE TYPE vehicle_status AS ENUM (
    'active',        -- moving / engine on
    'idle',          -- engine on, not moving
    'offline',       -- no signal / engine off
    'maintenance',   -- in service
    'alert'          -- requires immediate attention
);

CREATE TYPE vehicle_type AS ENUM (
    'truck', 'van', 'car', 'bus', 'motorcycle', 'heavy'
);

CREATE TYPE alert_severity AS ENUM (
    'critical', 'warning', 'info'
);

CREATE TYPE alert_type AS ENUM (
    'speeding',           -- exceeded speed limit
    'geofence_enter',     -- entered restricted zone
    'geofence_exit',      -- left allowed zone
    'harsh_braking',      -- sudden deceleration
    'harsh_acceleration', -- sudden acceleration
    'idle_timeout',       -- idling too long
    'sos',                -- driver emergency
    'low_fuel',           -- fuel below threshold
    'maintenance_due',    -- service overdue
    'offline',            -- lost signal
    'fatigue'             -- driving hours exceeded
);

CREATE TYPE driver_status AS ENUM (
    'active', 'inactive', 'on_leave', 'suspended'
);

CREATE TYPE trip_status AS ENUM (
    'planned', 'active', 'completed', 'cancelled'
);

CREATE TYPE maintenance_type AS ENUM (
    'oil_change', 'brake_service', 'tire_rotation',
    'full_service', 'battery', 'transmission',
    'electrical', 'bodywork', 'inspection', 'other'
);

DO $$ BEGIN RAISE NOTICE '    [OK] 6 enums created'; END $$;

-- ──────────────────────────────────────────────────────────
-- 3. TABLES
-- ──────────────────────────────────────────────────────────

DO $$ BEGIN RAISE NOTICE '[3] Creating tables...'; END $$;

-- ── users ──────────────────────────────────────────────────

CREATE TABLE users (
    id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name     VARCHAR(255) NOT NULL,
    role          VARCHAR(50)  NOT NULL DEFAULT 'operator',
                  -- admin | operator | viewer | driver
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    last_login    TIMESTAMPTZ,
    avatar_url    TEXT,
    phone         VARCHAR(50),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  users             IS 'Platform users: admins, operators, viewers';
COMMENT ON COLUMN users.role        IS 'admin | operator | viewer | driver';
COMMENT ON COLUMN users.password_hash IS 'bcrypt hash, never store plaintext';

-- ── depots ─────────────────────────────────────────────────

CREATE TABLE depots (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(255) NOT NULL,
    address     TEXT,
    city        VARCHAR(100) DEFAULT 'Lahore',
    country     VARCHAR(100) DEFAULT 'Pakistan',
    location    GEOMETRY(Point, 4326) NOT NULL, -- PostGIS WGS84 point
    capacity    INTEGER      DEFAULT 50,
    manager     VARCHAR(255),
    phone       VARCHAR(50),
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN depots.location IS 'PostGIS Point (longitude, latitude) in WGS84';

-- ── drivers ────────────────────────────────────────────────

CREATE TABLE drivers (
    id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id       VARCHAR(50)  UNIQUE NOT NULL,
    full_name         VARCHAR(255) NOT NULL,
    phone             VARCHAR(50),
    email             VARCHAR(255),
    license_number    VARCHAR(100) UNIQUE NOT NULL,
    license_class     VARCHAR(20)  DEFAULT 'LTV',   -- LTV | HTV | PSV
    license_expiry    DATE         NOT NULL,
    status            driver_status NOT NULL DEFAULT 'active',

    -- Aggregated safety metrics
    safety_score      NUMERIC(5,2) DEFAULT 100.00 CHECK (safety_score BETWEEN 0 AND 100),
    total_distance_km NUMERIC(12,2) DEFAULT 0,
    total_trips       INTEGER       DEFAULT 0,
    total_hours       NUMERIC(10,2) DEFAULT 0,

    -- Associations
    depot_id          UUID REFERENCES depots(id) ON DELETE SET NULL,
    photo_url         TEXT,
    emergency_contact VARCHAR(255),
    notes             TEXT,

    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN drivers.safety_score IS 'AI-computed composite score 0-100, higher=safer';
COMMENT ON COLUMN drivers.license_class IS 'LTV=Light, HTV=Heavy, PSV=Passenger';

-- ── vehicles ───────────────────────────────────────────────

CREATE TABLE vehicles (
    id                UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    registration      VARCHAR(50)  UNIQUE NOT NULL,
    make              VARCHAR(100) NOT NULL,
    model             VARCHAR(100) NOT NULL,
    year              SMALLINT     NOT NULL CHECK (year BETWEEN 1990 AND 2030),
    type              vehicle_type NOT NULL DEFAULT 'truck',
    color             VARCHAR(50),
    vin               VARCHAR(100) UNIQUE,

    -- Live telemetry (updated by simulator / GPS device)
    status            vehicle_status NOT NULL DEFAULT 'offline',
    current_location  GEOMETRY(Point, 4326),           -- PostGIS WGS84 point
    current_speed     NUMERIC(6,2)   DEFAULT 0  CHECK (current_speed >= 0),
    current_heading   NUMERIC(6,2)   DEFAULT 0  CHECK (current_heading BETWEEN 0 AND 360),
    current_fuel      NUMERIC(5,2)   DEFAULT 100 CHECK (current_fuel BETWEEN 0 AND 100),
    current_odometer  NUMERIC(12,2)  DEFAULT 0,
    engine_on         BOOLEAN        DEFAULT FALSE,
    last_seen         TIMESTAMPTZ,

    -- Specifications
    fuel_capacity     NUMERIC(8,2)   DEFAULT 60,
    fuel_type         VARCHAR(20)    DEFAULT 'diesel', -- diesel | petrol | hybrid | electric
    fuel_efficiency   NUMERIC(6,2)   DEFAULT 10,       -- L/100km
    max_speed         NUMERIC(6,2)   DEFAULT 120,
    payload_capacity  NUMERIC(10,2),                   -- kg
    seats             SMALLINT,

    -- Health & maintenance
    health_score      NUMERIC(5,2)   DEFAULT 100 CHECK (health_score BETWEEN 0 AND 100),
    last_service_date DATE,
    last_service_km   NUMERIC(12,2),
    next_service_km   NUMERIC(12,2),
    insurance_expiry  DATE,
    registration_expiry DATE,

    -- Associations
    assigned_driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
    depot_id           UUID REFERENCES depots(id)  ON DELETE SET NULL,

    -- Metadata
    purchase_date     DATE,
    purchase_price    NUMERIC(12,2),
    notes             TEXT,

    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN vehicles.current_location IS 'Live WGS84 point updated every ~3s by GPS/simulator';
COMMENT ON COLUMN vehicles.health_score     IS 'Composite AI score: engine+brakes+tires+battery';

-- ── telemetry ──────────────────────────────────────────────
-- Append-only time-series. Never UPDATE this table.
-- Partition by month in production for large fleets.

CREATE TABLE telemetry (
    id              BIGSERIAL    PRIMARY KEY,
    vehicle_id      UUID         NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    recorded_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    location        GEOMETRY(Point, 4326) NOT NULL,
    speed           NUMERIC(6,2)  DEFAULT 0,
    heading         NUMERIC(6,2)  DEFAULT 0,
    altitude        NUMERIC(8,2),                 -- metres ASL
    accuracy        NUMERIC(8,2),                 -- GPS accuracy in metres

    fuel_level      NUMERIC(5,2),                 -- percent
    odometer        NUMERIC(12,2),                -- km
    engine_on       BOOLEAN       DEFAULT TRUE,

    -- OBD-II diagnostics
    rpm             INTEGER,
    engine_temp     NUMERIC(6,2),                 -- °C
    battery_voltage NUMERIC(5,2),                 -- V
    throttle        NUMERIC(5,2),                 -- percent
    satellites      SMALLINT,

    -- Calculated on insert
    trip_id         UUID REFERENCES trips(id) ON DELETE SET NULL
);

-- Partition hint comment — implement in production:
COMMENT ON TABLE telemetry IS 'Append-only GPS time-series. Partition by recorded_at monthly for >1M rows/day';

-- ── trips ──────────────────────────────────────────────────

CREATE TABLE trips (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_id      UUID        NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    driver_id       UUID        REFERENCES drivers(id) ON DELETE SET NULL,
    status          trip_status NOT NULL DEFAULT 'planned',

    -- Spatial (PostGIS)
    origin          GEOMETRY(Point, 4326),
    destination     GEOMETRY(Point, 4326),
    route_path      GEOMETRY(LineString, 4326),    -- actual driven path
    planned_path    GEOMETRY(LineString, 4326),    -- planned route

    -- Addresses (reverse-geocoded)
    origin_address  TEXT,
    dest_address    TEXT,

    -- Timing
    planned_start   TIMESTAMPTZ,
    planned_end     TIMESTAMPTZ,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,

    -- Statistics (computed at trip end)
    distance_km     NUMERIC(10,2) DEFAULT 0,
    duration_mins   INTEGER       DEFAULT 0,
    avg_speed       NUMERIC(6,2),
    max_speed       NUMERIC(6,2),
    fuel_used       NUMERIC(8,2),
    idle_time_mins  INTEGER       DEFAULT 0,
    harsh_events    INTEGER       DEFAULT 0,
    co2_kg          NUMERIC(8,2),                  -- estimated CO₂ emissions

    -- References
    load_description TEXT,
    load_weight_kg   NUMERIC(10,2),
    notes            TEXT,
    customer_ref     VARCHAR(100),

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── geofences ──────────────────────────────────────────────

CREATE TABLE geofences (
    id              UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    boundary        GEOMETRY(Polygon, 4326) NOT NULL,  -- PostGIS polygon

    -- Display
    color           VARCHAR(20)  DEFAULT '#00d4e8',
    fill_opacity    NUMERIC(3,2) DEFAULT 0.10 CHECK (fill_opacity BETWEEN 0 AND 1),

    -- Behaviour
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    alert_on_enter  BOOLEAN      DEFAULT TRUE,
    alert_on_exit   BOOLEAN      DEFAULT TRUE,
    speed_limit     NUMERIC(6,2),                       -- optional zone speed limit km/h
    allowed_hours   VARCHAR(100),                       -- e.g. '08:00-20:00' Mon-Fri

    -- Metadata
    zone_type       VARCHAR(50)  DEFAULT 'delivery',    -- delivery | restricted | depot | customer | route
    created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN geofences.boundary IS 'PostGIS Polygon in WGS84 — closed ring required';

-- ── alerts ─────────────────────────────────────────────────

CREATE TABLE alerts (
    id              UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_id      UUID         REFERENCES vehicles(id)  ON DELETE CASCADE,
    driver_id       UUID         REFERENCES drivers(id)   ON DELETE SET NULL,
    trip_id         UUID         REFERENCES trips(id)     ON DELETE SET NULL,
    geofence_id     UUID         REFERENCES geofences(id) ON DELETE SET NULL,

    type            alert_type    NOT NULL,
    severity        alert_severity NOT NULL DEFAULT 'warning',
    title           VARCHAR(255)  NOT NULL,
    message         TEXT,

    location        GEOMETRY(Point, 4326),
    speed           NUMERIC(6,2),
    additional_data JSONB,                             -- flexible: RPM, G-force, etc.

    -- Resolution
    is_read         BOOLEAN       DEFAULT FALSE,
    is_resolved     BOOLEAN       DEFAULT FALSE,
    resolved_by     UUID REFERENCES users(id) ON DELETE SET NULL,
    resolved_at     TIMESTAMPTZ,
    resolution_note TEXT,

    occurred_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ── driver_scores ───────────────────────────────────────────

CREATE TABLE driver_scores (
    id                  UUID     PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id           UUID     NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    trip_id             UUID     REFERENCES trips(id) ON DELETE SET NULL,
    period_date         DATE     NOT NULL,
    period_type         VARCHAR(20) DEFAULT 'daily',   -- daily | weekly | monthly | trip

    -- Composite scores (0-100)
    overall_score       NUMERIC(5,2),
    speed_score         NUMERIC(5,2),
    braking_score       NUMERIC(5,2),
    cornering_score     NUMERIC(5,2),
    fatigue_score       NUMERIC(5,2),
    fuel_score          NUMERIC(5,2),

    -- Raw event counts
    speeding_events     INTEGER DEFAULT 0,
    harsh_braking       INTEGER DEFAULT 0,
    harsh_acceleration  INTEGER DEFAULT 0,
    sharp_cornering     INTEGER DEFAULT 0,
    phone_use_events    INTEGER DEFAULT 0,
    seatbelt_violations INTEGER DEFAULT 0,

    -- Distance / time
    distance_km         NUMERIC(10,2),
    driving_hours       NUMERIC(8,2),

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (driver_id, period_date, period_type)
);

-- ── maintenance ─────────────────────────────────────────────

CREATE TABLE maintenance (
    id               UUID             PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_id       UUID             NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    type             maintenance_type NOT NULL DEFAULT 'other',
    description      TEXT,

    status           VARCHAR(50) DEFAULT 'scheduled',
                     -- scheduled | in_progress | completed | cancelled
    priority         VARCHAR(20) DEFAULT 'normal',
                     -- low | normal | high | critical

    scheduled_date   DATE,
    completed_date   DATE,

    odometer_at      NUMERIC(12,2),
    next_service_km  NUMERIC(12,2),

    cost             NUMERIC(10,2),
    currency         VARCHAR(3)   DEFAULT 'PKR',
    parts_cost       NUMERIC(10,2),
    labour_cost      NUMERIC(10,2),

    technician       VARCHAR(255),
    workshop         VARCHAR(255),
    invoice_ref      VARCHAR(100),

    notes            TEXT,
    ai_predicted     BOOLEAN DEFAULT FALSE,   -- flagged by predictive AI
    ai_confidence    NUMERIC(4,2),            -- 0-1

    created_by       UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN RAISE NOTICE '    [OK] 10 tables created'; END $$;

-- ──────────────────────────────────────────────────────────
-- 4. INDEXES
-- ──────────────────────────────────────────────────────────

DO $$ BEGIN RAISE NOTICE '[4] Creating indexes...'; END $$;

-- Spatial GIST indexes (critical for ST_Within, ST_DWithin, etc.)
CREATE INDEX idx_vehicles_location   ON vehicles   USING GIST (current_location);
CREATE INDEX idx_telemetry_location  ON telemetry  USING GIST (location);
CREATE INDEX idx_trips_origin        ON trips      USING GIST (origin);
CREATE INDEX idx_trips_destination   ON trips      USING GIST (destination);
CREATE INDEX idx_trips_route         ON trips      USING GIST (route_path);
CREATE INDEX idx_geofences_boundary  ON geofences  USING GIST (boundary);
CREATE INDEX idx_alerts_location     ON alerts     USING GIST (location);
CREATE INDEX idx_depots_location     ON depots     USING GIST (location);

-- B-Tree indexes for common query patterns
CREATE INDEX idx_vehicles_status     ON vehicles (status);
CREATE INDEX idx_vehicles_type       ON vehicles (type);
CREATE INDEX idx_vehicles_driver     ON vehicles (assigned_driver_id);
CREATE INDEX idx_vehicles_depot      ON vehicles (depot_id);

CREATE INDEX idx_telemetry_vid_time  ON telemetry (vehicle_id, recorded_at DESC);
CREATE INDEX idx_telemetry_time      ON telemetry (recorded_at DESC);
CREATE INDEX idx_telemetry_trip      ON telemetry (trip_id);

CREATE INDEX idx_trips_vehicle       ON trips (vehicle_id);
CREATE INDEX idx_trips_driver        ON trips (driver_id);
CREATE INDEX idx_trips_status        ON trips (status);
CREATE INDEX idx_trips_started       ON trips (started_at DESC);

CREATE INDEX idx_alerts_vehicle      ON alerts (vehicle_id);
CREATE INDEX idx_alerts_type         ON alerts (type);
CREATE INDEX idx_alerts_severity     ON alerts (severity);
CREATE INDEX idx_alerts_occurred     ON alerts (occurred_at DESC);
CREATE INDEX idx_alerts_unread       ON alerts (is_read) WHERE is_read = FALSE;
CREATE INDEX idx_alerts_vehicle_type ON alerts (vehicle_id, type, occurred_at DESC);

CREATE INDEX idx_driver_scores_driver ON driver_scores (driver_id);
CREATE INDEX idx_driver_scores_date   ON driver_scores (period_date DESC);

CREATE INDEX idx_maintenance_vehicle  ON maintenance (vehicle_id);
CREATE INDEX idx_maintenance_status   ON maintenance (status);
CREATE INDEX idx_maintenance_date     ON maintenance (scheduled_date);
CREATE INDEX idx_maintenance_type     ON maintenance (type);

-- Full-text / trigram search
CREATE INDEX idx_vehicles_reg_trgm   ON vehicles USING GIN (registration gin_trgm_ops);
CREATE INDEX idx_drivers_name_trgm   ON drivers  USING GIN (full_name gin_trgm_ops);

-- Composite for time-range + vehicle
CREATE INDEX idx_telemetry_vid_range ON telemetry (vehicle_id, recorded_at)
    WHERE engine_on = TRUE;

DO $$ BEGIN RAISE NOTICE '    [OK] 30 indexes created (8 GIST spatial, 22 B-Tree/GIN)'; END $$;

-- ──────────────────────────────────────────────────────────
-- 5. TRIGGERS & FUNCTIONS
-- ──────────────────────────────────────────────────────────

DO $$ BEGIN RAISE NOTICE '[5] Creating triggers and functions...'; END $$;

-- 5a. Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_vehicles_updated_at
    BEFORE UPDATE ON vehicles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_drivers_updated_at
    BEFORE UPDATE ON drivers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_trips_updated_at
    BEFORE UPDATE ON trips
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_geofences_updated_at
    BEFORE UPDATE ON geofences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_maintenance_updated_at
    BEFORE UPDATE ON maintenance
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 5b. Return all geofences and whether a given vehicle is inside each
CREATE OR REPLACE FUNCTION get_vehicle_geofences(v_id UUID)
RETURNS TABLE (
    geofence_id   UUID,
    geofence_name VARCHAR,
    zone_type     VARCHAR,
    is_inside     BOOLEAN,
    distance_m    FLOAT
) LANGUAGE SQL STABLE AS $$
    SELECT
        g.id,
        g.name,
        g.zone_type,
        ST_Within(v.current_location, g.boundary) AS is_inside,
        ST_Distance(
            v.current_location::geography,
            ST_Centroid(g.boundary)::geography
        ) AS distance_m
    FROM geofences g
    CROSS JOIN vehicles v
    WHERE v.id = v_id
      AND v.current_location IS NOT NULL
      AND g.is_active = TRUE
    ORDER BY distance_m;
$$;

-- 5c. Find vehicles within a given radius of a coordinate
CREATE OR REPLACE FUNCTION vehicles_near_point(
    lng      FLOAT,
    lat      FLOAT,
    radius_m FLOAT DEFAULT 5000
)
RETURNS TABLE (
    vehicle_id     UUID,
    registration   VARCHAR,
    vehicle_name   TEXT,
    status         vehicle_status,
    driver_name    VARCHAR,
    distance_m     FLOAT,
    speed          NUMERIC,
    lng            FLOAT,
    lat            FLOAT
) LANGUAGE SQL STABLE AS $$
    SELECT
        v.id,
        v.registration,
        v.make || ' ' || v.model,
        v.status,
        d.full_name,
        ST_Distance(
            v.current_location::geography,
            ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
        ) AS distance_m,
        v.current_speed,
        ST_X(v.current_location),
        ST_Y(v.current_location)
    FROM vehicles v
    LEFT JOIN drivers d ON v.assigned_driver_id = d.id
    WHERE v.current_location IS NOT NULL
      AND ST_DWithin(
          v.current_location::geography,
          ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
          radius_m
      )
    ORDER BY distance_m;
$$;

-- 5d. Compute and upsert a driver's safety score for a given day
CREATE OR REPLACE FUNCTION compute_driver_score(
    p_driver_id UUID,
    p_date      DATE DEFAULT CURRENT_DATE
)
RETURNS NUMERIC LANGUAGE plpgsql AS $$
DECLARE
    v_speeding     INTEGER;
    v_braking      INTEGER;
    v_accel        INTEGER;
    v_score        NUMERIC(5,2);
    v_dist         NUMERIC(10,2);
BEGIN
    SELECT
        COALESCE(COUNT(*) FILTER (WHERE type = 'speeding'),          0),
        COALESCE(COUNT(*) FILTER (WHERE type = 'harsh_braking'),     0),
        COALESCE(COUNT(*) FILTER (WHERE type = 'harsh_acceleration'), 0)
    INTO v_speeding, v_braking, v_accel
    FROM alerts
    WHERE driver_id = p_driver_id
      AND occurred_at::DATE = p_date;

    SELECT COALESCE(SUM(distance_km), 0)
    INTO v_dist
    FROM trips
    WHERE driver_id = p_driver_id
      AND started_at::DATE = p_date
      AND status = 'completed';

    -- Simple penalty-based scoring (100 = perfect)
    v_score := GREATEST(0,
        100.0
        - (v_speeding * 5.0)
        - (v_braking  * 3.0)
        - (v_accel    * 2.0)
    );

    INSERT INTO driver_scores (
        driver_id, period_date, period_type,
        overall_score,
        speeding_events, harsh_braking, harsh_acceleration,
        distance_km
    ) VALUES (
        p_driver_id, p_date, 'daily',
        v_score,
        v_speeding, v_braking, v_accel,
        v_dist
    )
    ON CONFLICT (driver_id, period_date, period_type)
    DO UPDATE SET
        overall_score      = EXCLUDED.overall_score,
        speeding_events    = EXCLUDED.speeding_events,
        harsh_braking      = EXCLUDED.harsh_braking,
        harsh_acceleration = EXCLUDED.harsh_acceleration,
        distance_km        = EXCLUDED.distance_km;

    -- Update rolling score on driver record
    UPDATE drivers
    SET safety_score = (
        SELECT ROUND(AVG(overall_score), 2)
        FROM driver_scores
        WHERE driver_id = p_driver_id
          AND period_date >= CURRENT_DATE - INTERVAL '30 days'
    )
    WHERE id = p_driver_id;

    RETURN v_score;
END;
$$;

-- 5e. Fleet KPI snapshot (for dashboard API)
CREATE OR REPLACE FUNCTION fleet_kpi_snapshot()
RETURNS TABLE (
    total_vehicles     BIGINT,
    active_vehicles    BIGINT,
    idle_vehicles      BIGINT,
    offline_vehicles   BIGINT,
    maintenance_count  BIGINT,
    avg_speed_kmh      NUMERIC,
    avg_fuel_pct       NUMERIC,
    avg_health_score   NUMERIC,
    unread_alerts      BIGINT,
    critical_alerts    BIGINT,
    alerts_today       BIGINT,
    avg_driver_score   NUMERIC,
    active_trips       BIGINT
) LANGUAGE SQL STABLE AS $$
    SELECT
        COUNT(*)                                          FILTER (WHERE TRUE),
        COUNT(*) FILTER (WHERE status = 'active'),
        COUNT(*) FILTER (WHERE status = 'idle'),
        COUNT(*) FILTER (WHERE status = 'offline'),
        COUNT(*) FILTER (WHERE status = 'maintenance'),
        ROUND(AVG(current_speed) FILTER (WHERE status = 'active'), 1),
        ROUND(AVG(current_fuel), 1),
        ROUND(AVG(health_score), 1),
        (SELECT COUNT(*) FROM alerts WHERE is_read = FALSE),
        (SELECT COUNT(*) FROM alerts WHERE severity = 'critical' AND is_read = FALSE),
        (SELECT COUNT(*) FROM alerts WHERE occurred_at > NOW() - INTERVAL '24 hours'),
        (SELECT ROUND(AVG(safety_score), 1) FROM drivers WHERE status = 'active'),
        (SELECT COUNT(*) FROM trips WHERE status = 'active')
    FROM vehicles;
$$;

DO $$ BEGIN RAISE NOTICE '    [OK] 6 triggers, 5 functions created'; END $$;

-- ──────────────────────────────────────────────────────────
-- 6. VIEWS
-- ──────────────────────────────────────────────────────────

DO $$ BEGIN RAISE NOTICE '[6] Creating views...'; END $$;

-- Live fleet overview (primary API source)
CREATE OR REPLACE VIEW v_fleet_live AS
SELECT
    v.id,
    v.registration,
    v.make || ' ' || v.model       AS vehicle_name,
    v.make,
    v.model,
    v.year,
    v.type,
    v.color,
    v.status,
    v.current_speed,
    v.current_heading,
    v.current_fuel,
    v.current_odometer,
    v.engine_on,
    v.health_score,
    v.last_seen,
    v.fuel_capacity,
    v.max_speed,

    -- PostGIS → plain coordinates
    ST_X(v.current_location)       AS longitude,
    ST_Y(v.current_location)       AS latitude,

    -- PostGIS → GeoJSON (for DeckGL / Mapbox)
    ST_AsGeoJSON(v.current_location)::json AS location_geojson,

    -- Driver
    d.id                           AS driver_id,
    d.full_name                    AS driver_name,
    d.phone                        AS driver_phone,
    d.safety_score                 AS driver_score,
    d.license_number,

    -- Depot
    dp.id                          AS depot_id,
    dp.name                        AS depot_name,

    -- Unread alerts in last 24h
    COALESCE(a.unread_count, 0)    AS unread_alerts

FROM vehicles v
LEFT JOIN drivers d   ON v.assigned_driver_id = d.id
LEFT JOIN depots  dp  ON v.depot_id = dp.id
LEFT JOIN (
    SELECT vehicle_id, COUNT(*) AS unread_count
    FROM alerts
    WHERE is_read = FALSE
      AND occurred_at > NOW() - INTERVAL '24 hours'
    GROUP BY vehicle_id
) a ON a.vehicle_id = v.id;

-- Geofence violation history
CREATE OR REPLACE VIEW v_geofence_violations AS
SELECT
    a.id              AS alert_id,
    a.occurred_at,
    a.type,
    a.severity,
    a.is_read,
    v.registration,
    v.make || ' ' || v.model AS vehicle_name,
    g.name            AS geofence_name,
    g.zone_type       AS geofence_type,
    d.full_name       AS driver_name,
    ST_X(a.location)  AS longitude,
    ST_Y(a.location)  AS latitude,
    ST_AsGeoJSON(a.location)::json AS location_geojson
FROM alerts a
JOIN vehicles  v  ON a.vehicle_id  = v.id
JOIN geofences g  ON a.geofence_id = g.id
LEFT JOIN drivers d ON a.driver_id = d.id
WHERE a.type IN ('geofence_enter', 'geofence_exit')
ORDER BY a.occurred_at DESC;

-- Trip summary with distances and durations
CREATE OR REPLACE VIEW v_trip_summary AS
SELECT
    t.id,
    t.status,
    t.started_at,
    t.completed_at,
    t.distance_km,
    t.duration_mins,
    ROUND(t.duration_mins::NUMERIC / 60, 2) AS duration_hours,
    t.avg_speed,
    t.max_speed,
    t.fuel_used,
    t.idle_time_mins,
    t.harsh_events,
    t.co2_kg,
    t.origin_address,
    t.dest_address,
    ST_X(t.origin)      AS origin_lng,
    ST_Y(t.origin)      AS origin_lat,
    ST_X(t.destination) AS dest_lng,
    ST_Y(t.destination) AS dest_lat,
    CASE WHEN t.route_path IS NOT NULL
         THEN ST_Length(t.route_path::geography) / 1000
         ELSE NULL
    END                 AS gps_distance_km,  -- PostGIS calculated
    v.registration,
    v.make || ' ' || v.model AS vehicle_name,
    d.full_name         AS driver_name
FROM trips t
JOIN vehicles v  ON t.vehicle_id = v.id
LEFT JOIN drivers d ON t.driver_id = d.id;

-- Driver safety leaderboard
CREATE OR REPLACE VIEW v_driver_leaderboard AS
SELECT
    d.id,
    d.employee_id,
    d.full_name,
    d.status,
    d.safety_score                    AS current_score,
    d.total_distance_km,
    d.total_trips,
    d.license_class,
    d.license_expiry,

    -- Latest daily score
    ds.overall_score                  AS latest_score,
    ds.period_date                    AS score_date,
    ds.speeding_events,
    ds.harsh_braking,
    ds.harsh_acceleration,
    ds.distance_km                    AS distance_today,

    -- Assigned vehicle
    v.registration                    AS vehicle_reg,
    v.status                          AS vehicle_status,
    v.make || ' ' || v.model          AS vehicle_name,

    -- Rank by safety score
    RANK() OVER (ORDER BY d.safety_score DESC) AS rank

FROM drivers d
LEFT JOIN LATERAL (
    SELECT * FROM driver_scores
    WHERE driver_id = d.id
    ORDER BY period_date DESC
    LIMIT 1
) ds ON TRUE
LEFT JOIN vehicles v ON v.assigned_driver_id = d.id;

-- Vehicle health dashboard
CREATE OR REPLACE VIEW v_vehicle_health AS
SELECT
    v.id,
    v.registration,
    v.make || ' ' || v.model           AS vehicle_name,
    v.year,
    v.type,
    v.health_score,
    v.current_odometer,
    v.last_service_date,
    v.next_service_km,
    v.insurance_expiry,
    v.registration_expiry,

    -- Next scheduled maintenance
    m.type                             AS next_maintenance_type,
    m.scheduled_date                   AS next_maintenance_date,
    m.priority                         AS maintenance_priority,
    m.ai_predicted,

    -- Days until insurance expires
    (v.insurance_expiry - CURRENT_DATE) AS insurance_days_left,

    -- km until next service
    (v.next_service_km - v.current_odometer) AS km_to_service,

    -- Unresolved alerts count
    COALESCE(ac.alert_count, 0)        AS open_alerts

FROM vehicles v
LEFT JOIN LATERAL (
    SELECT type, scheduled_date, priority, ai_predicted
    FROM maintenance
    WHERE vehicle_id = v.id
      AND status = 'scheduled'
    ORDER BY scheduled_date ASC
    LIMIT 1
) m ON TRUE
LEFT JOIN (
    SELECT vehicle_id, COUNT(*) AS alert_count
    FROM alerts
    WHERE is_resolved = FALSE
    GROUP BY vehicle_id
) ac ON ac.vehicle_id = v.id;

-- Daily fleet statistics (for analytics charts)
CREATE OR REPLACE VIEW v_daily_fleet_stats AS
SELECT
    DATE_TRUNC('day', t.recorded_at)   AS day,
    COUNT(DISTINCT t.vehicle_id)        AS active_vehicles,
    ROUND(AVG(t.speed), 1)             AS avg_speed,
    ROUND(MAX(t.speed), 1)             AS max_speed_recorded,
    ROUND(AVG(t.fuel_level), 1)        AS avg_fuel,
    COUNT(*)                            AS total_pings,
    COUNT(DISTINCT tr.id)               AS completed_trips,
    ROUND(SUM(tr.distance_km), 1)       AS total_distance_km,
    ROUND(SUM(tr.fuel_used), 1)         AS total_fuel_used
FROM telemetry t
LEFT JOIN trips tr ON tr.vehicle_id = t.vehicle_id
    AND DATE_TRUNC('day', t.recorded_at) = DATE_TRUNC('day', tr.started_at)
    AND tr.status = 'completed'
GROUP BY DATE_TRUNC('day', t.recorded_at)
ORDER BY day DESC;

DO $$ BEGIN RAISE NOTICE '    [OK] 6 views created'; END $$;

-- ──────────────────────────────────────────────────────────
-- 7. TEST DATA
-- ──────────────────────────────────────────────────────────

DO $$ BEGIN RAISE NOTICE '[7] Inserting test data...'; END $$;

-- ── 7a. Admin users ────────────────────────────────────────

DO $$ BEGIN RAISE NOTICE '    -> users...'; END $$;

INSERT INTO users (email, password_hash, full_name, role, phone) VALUES
-- password for all demo accounts: 'admin123' (bcrypt hash below)
('admin@cloudnext.com',    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'System Administrator', 'admin',    '+92-300-0000001'),
('operator@cloudnext.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Fleet Operator',       'operator', '+92-300-0000002'),
('viewer@cloudnext.com',   '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Report Viewer',        'viewer',   '+92-300-0000003'),
('zubair@cloudnext.com',   '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Zubair Hassan',        'operator', '+92-300-0000004');

-- ── 7b. Depots ─────────────────────────────────────────────

DO $$ BEGIN RAISE NOTICE '    -> depots...'; END $$;

INSERT INTO depots (name, address, city, location, capacity, manager, phone) VALUES
('Raiwind Road Depot',
 'Near Raiwind Road Toll Plaza, Lahore',
 'Lahore',
 ST_SetSRID(ST_MakePoint(74.3200, 31.4800), 4326),
 60, 'Asif Nawaz', '+92-42-35123001'),

('DHA Phase 5 Hub',
 'Sector E, DHA Phase 5, Lahore',
 'Lahore',
 ST_SetSRID(ST_MakePoint(74.4100, 31.4700), 4326),
 40, 'Rashid Mahmood', '+92-42-35123002'),

('Gulberg Central Base',
 'Main Boulevard, Gulberg III, Lahore',
 'Lahore',
 ST_SetSRID(ST_MakePoint(74.3450, 31.5100), 4326),
 35, 'Nadia Iqbal', '+92-42-35123003'),

('Johar Town Terminal',
 'Block D, Johar Town, Lahore',
 'Lahore',
 ST_SetSRID(ST_MakePoint(74.2900, 31.4680), 4326),
 30, 'Kamran Butt', '+92-42-35123004');

-- ── 7c. Drivers ────────────────────────────────────────────

DO $$ BEGIN RAISE NOTICE '    -> drivers...'; END $$;

INSERT INTO drivers (
    employee_id, full_name, phone, email,
    license_number, license_class, license_expiry,
    status, safety_score, total_distance_km, total_trips,
    depot_id
)
SELECT
    emp_id, name, phone, email,
    lic_num, lic_class, lic_expiry::DATE,
    status::driver_status, score, dist_km, trips,
    (SELECT id FROM depots ORDER BY RANDOM() LIMIT 1)
FROM (VALUES
    ('EMP-001','Ahmed Raza',      '+92-300-1234567','ahmed.raza@fleet.pk',    'LHR-DL-001','LTV','2028-06-30','active', 97.2, 34200, 412),
    ('EMP-002','Sajid Mehmood',   '+92-301-2345678','sajid.m@fleet.pk',       'LHR-DL-002','HTV','2027-03-31','active', 93.5, 51800, 289),
    ('EMP-003','Usman Tariq',     '+92-302-3456789','usman.t@fleet.pk',       'LHR-DL-003','LTV','2026-12-31','active', 81.0, 28400, 334),
    ('EMP-004','Bilal Chaudhry',  '+92-303-4567890','bilal.c@fleet.pk',       'LHR-DL-004','HTV','2027-09-30','active', 76.4, 62100, 201),
    ('EMP-005','Imran Gul',       '+92-304-5678901','imran.g@fleet.pk',       'LHR-DL-005','HTV','2025-11-30','active', 52.1, 44700, 178),
    ('EMP-006','Faisal Khan',     '+92-305-6789012','faisal.k@fleet.pk',      'LHR-DL-006','PSV','2028-02-28','active', 88.3, 39500, 521),
    ('EMP-007','Zubair Hassan',   '+92-306-7890123','zubair.h@fleet.pk',      'LHR-DL-007','LTV','2027-07-31','active', 91.8, 22100, 367),
    ('EMP-008','Wasim Akhtar',    '+92-307-8901234','wasim.a@fleet.pk',       'LHR-DL-008','HTV','2026-08-31','active', 85.5, 58900, 244),
    ('EMP-009','Rizwan Malik',    '+92-308-9012345','rizwan.m@fleet.pk',      'LHR-DL-009','LTV','2028-04-30','active', 79.2, 17600, 298),
    ('EMP-010','Tariq Javeed',    '+92-309-0123456','tariq.j@fleet.pk',       'LHR-DL-010','HTV','2027-11-30','active', 95.1, 71300, 156),
    ('EMP-011','Khalid Mehmood',  '+92-310-1234567','khalid.m@fleet.pk',      'LHR-DL-011','LTV','2026-05-31','active', 68.7, 31200, 408),
    ('EMP-012','Nadeem Iqbal',    '+92-311-2345678','nadeem.i@fleet.pk',      'LHR-DL-012','HTV','2028-10-31','active', 87.4, 45600, 312),
    ('EMP-013','Asad Ali',        '+92-312-3456789','asad.a@fleet.pk',        'LHR-DL-013','PSV','2027-01-31','on_leave', 83.0, 19800, 189),
    ('EMP-014','Waqas Siddiqui',  '+92-313-4567890','waqas.s@fleet.pk',       'LHR-DL-014','LTV','2025-08-31','active', 74.9, 26700, 223),
    ('EMP-015','Shoaib Akhtar',   '+92-314-5678901','shoaib.a2@fleet.pk',     'LHR-DL-015','HTV','2028-07-31','suspended',44.2, 38900, 134)
) AS t(emp_id,name,phone,email,lic_num,lic_class,lic_expiry,status,score,dist_km,trips);

-- ── 7d. Vehicles ───────────────────────────────────────────

DO $$ BEGIN RAISE NOTICE '    -> vehicles...'; END $$;

DO $$
DECLARE
    v_depot_ids  UUID[];
    v_driver_ids UUID[];

    -- Lahore centre + scatter
    v_base_lng   FLOAT := 74.3587;
    v_base_lat   FLOAT := 31.5204;

    v_vid        UUID;
    v_d_id       UUID;
    v_dep_id     UUID;
    v_lng        FLOAT;
    v_lat        FLOAT;
    v_status     vehicle_status;
    v_speed      NUMERIC;
    v_fuel       NUMERIC;
    v_odo        NUMERIC;
    v_heading    NUMERIC;

    v_data RECORD;
BEGIN
    SELECT ARRAY(SELECT id FROM depots ORDER BY created_at) INTO v_depot_ids;
    SELECT ARRAY(SELECT id FROM drivers WHERE status = 'active' ORDER BY created_at) INTO v_driver_ids;

    FOR v_data IN (
        SELECT * FROM (VALUES
            ('LHR-001','Isuzu',  'NPR 71L',   2021,'truck',  'White', 100, 80,  9.8, 95000, 'active',   true,  87.5),
            ('LHR-002','Hino',   '300 Series', 2022,'truck',  'Blue',  110, 90, 10.2, 62000, 'active',   true,  92.1),
            ('LHR-003','Fuso',   'Canter FE',  2020,'van',    'Silver',105, 70,  8.5, 88000, 'active',   true,  79.4),
            ('LHR-004','Tata',   'LPT 407',    2019,'heavy',   'Red',   90,120, 14.1,112000, 'active',   true,  71.2),
            ('LHR-005','Toyota', 'Hiace GL',   2023,'van',    'White', 120, 65,  7.9, 41000, 'active',   true,  96.3),
            ('LHR-006','Suzuki', 'Carry 660',  2022,'van',    'Yellow',100, 35,  7.2, 55000, 'idle',     false, 88.0),
            ('LHR-007','Isuzu',  'ELF NHR',   2021,'truck',  'Green', 105, 85,  9.5, 73000, 'active',   true,  84.6),
            ('LHR-008','Honda',  'CD-70',      2023,'motorcycle','Black',80, 12, 2.8,  28000, 'active',   true,  91.0),
            ('LHR-009','Toyota', 'Corolla GLi',2022,'car',    'White', 160, 45,  8.1, 34000, 'active',   true,  93.7),
            ('LHR-010','Hino',   '500 FC',     2020,'heavy',   'Orange', 85,150, 16.5,138000,'idle',     false, 68.9),
            ('LHR-011','MAN',    'TGS 18.400', 2021,'heavy',   'Gray',   90,200, 18.2,195000,'maintenance',false,74.3),
            ('LHR-012','Yutong', 'ZK6107H',    2022,'bus',    'Blue',  100,180, 19.0, 88000, 'active',   true,  89.2),
            ('LHR-013','Isuzu',  'NPR 57P',    2020,'truck',  'White', 100, 80,  9.9, 92000, 'active',   true,  82.5),
            ('LHR-014','Fuso',   'Super Great',2019,'heavy',   'Red',   85,210, 20.1,210000, 'offline',  false, 60.0),
            ('LHR-015','Toyota', 'Land Cruiser',2023,'car',   'Black', 180, 80,  11.0, 22000,'active',   true,  97.8),
            ('LHR-016','Suzuki', 'Alto VXR',   2023,'car',    'White', 140, 32,  5.2,  18000,'idle',     false, 90.1),
            ('LHR-017','Hino',   '300 Wide',   2021,'truck',  'Blue',  100, 90, 10.5, 67000, 'active',   true,  86.4),
            ('LHR-018','Daewoo', 'Istana',     2018,'bus',    'Yellow',100, 70, 13.5,154000, 'offline',  false, 55.0)
        ) AS t(reg,make,model,yr,vtype,color,mspd,fuel_cap,fuel_eff,odo_base,vstatus,eng,health)
    ) LOOP
        -- Scatter position around Lahore
        v_lng     := v_base_lng + (RANDOM() - 0.5) * 0.12;
        v_lat     := v_base_lat + (RANDOM() - 0.5) * 0.10;
        v_heading := FLOOR(RANDOM() * 360);
        v_fuel    := 15 + RANDOM() * 85;
        v_speed   := CASE v_data.vstatus WHEN 'active' THEN 20 + RANDOM() * 80 ELSE 0 END;
        v_odo     := v_data.odo_base + RANDOM() * 5000;

        -- Assign driver (if active)
        IF v_data.vstatus IN ('active','idle') THEN
            v_d_id := v_driver_ids[1 + FLOOR(RANDOM() * array_length(v_driver_ids, 1))::INT];
        ELSE
            v_d_id := NULL;
        END IF;
        v_dep_id := v_depot_ids[1 + FLOOR(RANDOM() * array_length(v_depot_ids, 1))::INT];

        INSERT INTO vehicles (
            registration, make, model, year, type, color,
            status, current_location, current_speed, current_heading,
            current_fuel, current_odometer, engine_on,
            fuel_capacity, fuel_efficiency, max_speed,
            health_score, last_seen,
            assigned_driver_id, depot_id,
            last_service_date, next_service_km,
            insurance_expiry, registration_expiry
        ) VALUES (
            v_data.reg, v_data.make, v_data.model, v_data.yr,
            v_data.vtype::vehicle_type, v_data.color,
            v_data.vstatus::vehicle_status,
            ST_SetSRID(ST_MakePoint(v_lng, v_lat), 4326),
            ROUND(v_speed::NUMERIC, 1), v_heading,
            ROUND(v_fuel::NUMERIC, 1),  ROUND(v_odo::NUMERIC, 0),
            v_data.eng,
            v_data.fuel_cap, v_data.fuel_eff, v_data.mspd,
            v_data.health,
            NOW() - (RANDOM() * INTERVAL '5 minutes'),
            v_d_id, v_dep_id,
            CURRENT_DATE - (FLOOR(RANDOM() * 365) || ' days')::INTERVAL,
            v_odo + 5000 + RANDOM() * 15000,
            CURRENT_DATE + (FLOOR(180 + RANDOM() * 500) || ' days')::INTERVAL,
            CURRENT_DATE + (FLOOR(90 + RANDOM() * 600) || ' days')::INTERVAL
        );
    END LOOP;
END $$;

-- ── 7e. Geofences ──────────────────────────────────────────

DO $$ BEGIN RAISE NOTICE '    -> geofences...'; END $$;

INSERT INTO geofences (name, description, color, zone_type, boundary, speed_limit, alert_on_enter, alert_on_exit)
VALUES
(
    'DHA Phase 5 Delivery Zone',
    'Primary delivery zone for DHA Phase 5 — residential and commercial',
    '#00d4e8', 'delivery',
    ST_SetSRID(ST_GeomFromText('POLYGON((74.38 31.45, 74.45 31.45, 74.45 31.50, 74.38 31.50, 74.38 31.45))'), 4326),
    60, TRUE, TRUE
),
(
    'Gulberg Commercial District',
    'Gulberg III & II commercial hub — deliveries permitted 6am–10pm',
    '#a3e635', 'delivery',
    ST_SetSRID(ST_GeomFromText('POLYGON((74.33 31.50, 74.37 31.50, 74.37 31.54, 74.33 31.54, 74.33 31.50))'), 4326),
    50, TRUE, FALSE
),
(
    'Allama Iqbal Airport Restricted',
    'No unauthorised commercial vehicles within airport perimeter',
    '#ef4444', 'restricted',
    ST_SetSRID(ST_GeomFromText('POLYGON((74.38 31.51, 74.42 31.51, 74.42 31.55, 74.38 31.55, 74.38 31.51))'), 4326),
    40, TRUE, TRUE
),
(
    'Johar Town Residential Zone',
    'Residential area — heavy vehicles restricted 10pm–6am',
    '#f59e0b', 'delivery',
    ST_SetSRID(ST_GeomFromText('POLYGON((74.27 31.45, 74.33 31.45, 74.33 31.50, 74.27 31.50, 74.27 31.45))'), 4326),
    40, TRUE, FALSE
),
(
    'Raiwind Road Depot Zone',
    'Authorised depot boundary — all vehicles permitted',
    '#22c55e', 'depot',
    ST_SetSRID(ST_GeomFromText('POLYGON((74.31 31.47, 74.33 31.47, 74.33 31.49, 74.31 31.49, 74.31 31.47))'), 4326),
    20, FALSE, FALSE
),
(
    'Model Town Zone',
    'Residential and commercial — speed limit enforced',
    '#a78bfa', 'delivery',
    ST_SetSRID(ST_GeomFromText('POLYGON((74.32 31.50, 74.36 31.50, 74.36 31.54, 74.32 31.54, 74.32 31.50))'), 4326),
    40, TRUE, TRUE
),
(
    'Cantt / Mall Road Corridor',
    'Heritage and military cantonment corridor — restricted access',
    '#fb923c', 'restricted',
    ST_SetSRID(ST_GeomFromText('POLYGON((74.32 31.55, 74.37 31.55, 74.37 31.58, 74.32 31.58, 74.32 31.55))'), 4326),
    30, TRUE, TRUE
);

-- ── 7f. Telemetry history (last 2 hours per active vehicle) ─

DO $$ BEGIN RAISE NOTICE '    -> telemetry history (2h per vehicle, ~120 points each)...'; END $$;

DO $$
DECLARE
    v_rec    RECORD;
    i        INTEGER;
    t_lng    FLOAT;
    t_lat    FLOAT;
    t_speed  FLOAT;
    t_head   FLOAT;
    t_fuel   FLOAT;
    t_rpm    INTEGER;
BEGIN
    FOR v_rec IN
        SELECT id,
               ST_X(current_location) AS base_lng,
               ST_Y(current_location) AS base_lat,
               current_fuel           AS base_fuel,
               current_odometer       AS base_odo,
               current_heading        AS base_heading
        FROM vehicles
        WHERE status = 'active'
        ORDER BY registration
    LOOP
        t_lng  := v_rec.base_lng;
        t_lat  := v_rec.base_lat;
        t_head := v_rec.base_heading;
        t_fuel := v_rec.base_fuel;

        -- Walk backwards: i=120 (120 min ago) → i=0 (now)
        FOR i IN REVERSE 120..0 LOOP
            t_speed := GREATEST(0, 20 + RANDOM() * 80 + SIN(i * 0.3) * 20);
            -- Drift position slightly each minute
            t_lng   := t_lng + SIN(RADIANS(t_head)) * 0.0001 * (t_speed / 60);
            t_lat   := t_lat + COS(RADIANS(t_head)) * 0.0001 * (t_speed / 60);
            t_head  := (t_head + (RANDOM() - 0.5) * 10 + 360)::INTEGER % 360;
            t_fuel  := GREATEST(5, t_fuel - (t_speed / 100) * 0.003);
            t_rpm   := (600 + t_speed * 30 + RANDOM() * 300)::INTEGER;

            INSERT INTO telemetry (
                vehicle_id, recorded_at,
                location, speed, heading, fuel_level,
                odometer, engine_on, rpm,
                engine_temp, battery_voltage, satellites
            ) VALUES (
                v_rec.id,
                NOW() - (i || ' minutes')::INTERVAL,
                ST_SetSRID(ST_MakePoint(t_lng, t_lat), 4326),
                ROUND(t_speed::NUMERIC, 1),
                ROUND(t_head::NUMERIC, 0),
                ROUND(t_fuel::NUMERIC, 1),
                v_rec.base_odo + (120 - i) * t_speed / 60,
                TRUE,
                t_rpm,
                75 + RANDOM() * 25,      -- engine temp 75-100°C
                12.2 + RANDOM() * 0.8,   -- battery 12.2-13.0V
                (8 + RANDOM() * 4)::INT  -- 8-12 GPS satellites
            );
        END LOOP;
    END LOOP;
END $$;

-- ── 7g. Completed trips ────────────────────────────────────

DO $$ BEGIN RAISE NOTICE '    -> trips...'; END $$;

DO $$
DECLARE
    v_ids    UUID[];
    d_ids    UUID[];
    v_id     UUID;
    d_id     UUID;
    o_lng    FLOAT; o_lat FLOAT;
    dest_lng FLOAT; dest_lat FLOAT;
    tr_started TIMESTAMPTZ;
    tr_ended   TIMESTAMPTZ;
    tr_dist    NUMERIC;
    tr_dur     INTEGER;
    i          INTEGER;
BEGIN
    SELECT ARRAY(SELECT id FROM vehicles WHERE status IN ('active','idle') ORDER BY registration) INTO v_ids;
    SELECT ARRAY(SELECT id FROM drivers WHERE status = 'active' ORDER BY created_at)              INTO d_ids;

    -- Insert 50 completed trips over the last 7 days
    FOR i IN 1..50 LOOP
        v_id     := v_ids[1 + FLOOR(RANDOM() * array_length(v_ids,1))::INT];
        d_id     := d_ids[1 + FLOOR(RANDOM() * array_length(d_ids,1))::INT];
        o_lng    := 74.28 + RANDOM() * 0.20;
        o_lat    := 31.45 + RANDOM() * 0.12;
        dest_lng := 74.28 + RANDOM() * 0.20;
        dest_lat := 31.45 + RANDOM() * 0.12;
        tr_started := NOW() - (FLOOR(RANDOM() * 10080) || ' minutes')::INTERVAL;  -- last 7 days
        tr_dist  := 5 + RANDOM() * 60;
        tr_dur   := (tr_dist / (30 + RANDOM() * 40) * 60)::INT;
        tr_ended := tr_started + (tr_dur || ' minutes')::INTERVAL;

        INSERT INTO trips (
            vehicle_id, driver_id, status,
            origin, destination, route_path,
            origin_address, dest_address,
            started_at, completed_at,
            planned_start, planned_end,
            distance_km, duration_mins,
            avg_speed, max_speed,
            fuel_used, idle_time_mins, harsh_events,
            co2_kg, load_weight_kg
        ) VALUES (
            v_id, d_id, 'completed',
            ST_SetSRID(ST_MakePoint(o_lng, o_lat), 4326),
            ST_SetSRID(ST_MakePoint(dest_lng, dest_lat), 4326),
            ST_MakeLine(ARRAY[
                ST_SetSRID(ST_MakePoint(o_lng, o_lat), 4326),
                ST_SetSRID(ST_MakePoint((o_lng+dest_lng)/2 + (RANDOM()-0.5)*0.02,
                                        (o_lat+dest_lat)/2 + (RANDOM()-0.5)*0.02), 4326),
                ST_SetSRID(ST_MakePoint(dest_lng, dest_lat), 4326)
            ]),
            'Origin, Lahore',
            'Destination, Lahore',
            tr_started, tr_ended,
            tr_started - INTERVAL '10 minutes', tr_ended + INTERVAL '5 minutes',
            ROUND(tr_dist::NUMERIC, 2),
            tr_dur,
            ROUND((tr_dist / (tr_dur / 60.0))::NUMERIC, 1),
            ROUND((50 + RANDOM() * 70)::NUMERIC, 1),
            ROUND((tr_dist * 0.10)::NUMERIC, 2),
            FLOOR(RANDOM() * 20)::INT,
            FLOOR(RANDOM() * 4)::INT,
            ROUND((tr_dist * 0.10 * 2.68)::NUMERIC, 2),  -- CO₂: diesel ~2.68 kg/L
            500 + FLOOR(RANDOM() * 4500)::INT
        );
    END LOOP;

    -- 3 active trips right now
    FOR i IN 1..3 LOOP
        v_id  := v_ids[i];
        d_id  := d_ids[i];
        o_lng := 74.30 + RANDOM() * 0.15;
        o_lat := 31.48 + RANDOM() * 0.08;
        INSERT INTO trips (
            vehicle_id, driver_id, status,
            origin, destination,
            origin_address, dest_address,
            started_at, planned_end,
            load_weight_kg
        ) VALUES (
            v_id, d_id, 'active',
            ST_SetSRID(ST_MakePoint(o_lng, o_lat), 4326),
            ST_SetSRID(ST_MakePoint(o_lng + 0.05, o_lat + 0.03), 4326),
            'Dispatch Hub, Lahore',
            'Customer Site, Lahore',
            NOW() - (FLOOR(RANDOM() * 45) || ' minutes')::INTERVAL,
            NOW() + INTERVAL '30 minutes',
            1200 + FLOOR(RANDOM() * 3000)::INT
        );
    END LOOP;
END $$;

-- ── 7h. Alerts (last 7 days) ───────────────────────────────

DO $$ BEGIN RAISE NOTICE '    -> alerts...'; END $$;

DO $$
DECLARE
    v_ids  UUID[];
    d_ids  UUID[];
    g_ids  UUID[];
    v_id   UUID;
    d_id   UUID;
    g_id   UUID;
    a_lng  FLOAT;
    a_lat  FLOAT;
    a_mins INTEGER;
    i      INTEGER;
BEGIN
    SELECT ARRAY(SELECT id FROM vehicles ORDER BY registration)     INTO v_ids;
    SELECT ARRAY(SELECT id FROM drivers  WHERE status = 'active')   INTO d_ids;
    SELECT ARRAY(SELECT id FROM geofences WHERE is_active = TRUE)   INTO g_ids;

    -- 80 realistic alerts spread over last 7 days
    FOR i IN 1..80 LOOP
        v_id  := v_ids[1 + FLOOR(RANDOM() * array_length(v_ids,1))::INT];
        d_id  := d_ids[1 + FLOOR(RANDOM() * array_length(d_ids,1))::INT];
        a_lng := 74.28 + RANDOM() * 0.20;
        a_lat := 31.45 + RANDOM() * 0.12;
        a_mins := FLOOR(RANDOM() * 10080);  -- random minute in last 7 days

        CASE FLOOR(RANDOM() * 8)::INT
            WHEN 0 THEN
                INSERT INTO alerts (vehicle_id, driver_id, type, severity, title, message, location, speed, occurred_at, is_read)
                VALUES (v_id, d_id, 'speeding', 'critical',
                    'Speed Limit Exceeded',
                    FORMAT('Vehicle exceeded limit at %s km/h in 80 km/h zone', FLOOR(85 + RANDOM()*35)::INT),
                    ST_SetSRID(ST_MakePoint(a_lng, a_lat), 4326),
                    FLOOR(85 + RANDOM()*35)::NUMERIC,
                    NOW() - (a_mins || ' minutes')::INTERVAL,
                    RANDOM() > 0.3);
            WHEN 1 THEN
                g_id := g_ids[1 + FLOOR(RANDOM() * array_length(g_ids,1))::INT];
                INSERT INTO alerts (vehicle_id, driver_id, geofence_id, type, severity, title, message, location, occurred_at, is_read)
                VALUES (v_id, d_id, g_id, 'geofence_exit', 'info',
                    'Geofence Zone Exit',
                    'Vehicle exited authorised delivery zone',
                    ST_SetSRID(ST_MakePoint(a_lng, a_lat), 4326),
                    NOW() - (a_mins || ' minutes')::INTERVAL,
                    RANDOM() > 0.5);
            WHEN 2 THEN
                g_id := g_ids[1 + FLOOR(RANDOM() * array_length(g_ids,1))::INT];
                INSERT INTO alerts (vehicle_id, driver_id, geofence_id, type, severity, title, message, location, occurred_at, is_read)
                VALUES (v_id, d_id, g_id, 'geofence_enter', 'warning',
                    'Restricted Zone Entry',
                    'Vehicle entered restricted geofence area',
                    ST_SetSRID(ST_MakePoint(a_lng, a_lat), 4326),
                    NOW() - (a_mins || ' minutes')::INTERVAL,
                    RANDOM() > 0.4);
            WHEN 3 THEN
                INSERT INTO alerts (vehicle_id, driver_id, type, severity, title, message, location, speed, occurred_at, is_read)
                VALUES (v_id, d_id, 'harsh_braking', 'warning',
                    'Harsh Braking Event',
                    FORMAT('Sudden deceleration from %s km/h detected', FLOOR(50+RANDOM()*50)::INT),
                    ST_SetSRID(ST_MakePoint(a_lng, a_lat), 4326),
                    FLOOR(50 + RANDOM()*50)::NUMERIC,
                    NOW() - (a_mins || ' minutes')::INTERVAL,
                    RANDOM() > 0.4);
            WHEN 4 THEN
                INSERT INTO alerts (vehicle_id, driver_id, type, severity, title, message, location, occurred_at, is_read)
                VALUES (v_id, d_id, 'low_fuel', 'warning',
                    'Low Fuel Warning',
                    FORMAT('Fuel level at %s%% — refuel required', FLOOR(5+RANDOM()*12)::INT),
                    ST_SetSRID(ST_MakePoint(a_lng, a_lat), 4326),
                    NOW() - (a_mins || ' minutes')::INTERVAL,
                    RANDOM() > 0.2);
            WHEN 5 THEN
                INSERT INTO alerts (vehicle_id, driver_id, type, severity, title, message, location, occurred_at, is_read)
                VALUES (v_id, d_id, 'idle_timeout', 'info',
                    'Extended Idle Detected',
                    FORMAT('Vehicle idling for %s minutes in non-depot zone', FLOOR(20+RANDOM()*40)::INT),
                    ST_SetSRID(ST_MakePoint(a_lng, a_lat), 4326),
                    NOW() - (a_mins || ' minutes')::INTERVAL,
                    RANDOM() > 0.6);
            WHEN 6 THEN
                INSERT INTO alerts (vehicle_id, driver_id, type, severity, title, message, location, occurred_at, is_read)
                VALUES (v_id, d_id, 'harsh_acceleration', 'warning',
                    'Harsh Acceleration',
                    'Aggressive throttle event recorded',
                    ST_SetSRID(ST_MakePoint(a_lng, a_lat), 4326),
                    NOW() - (a_mins || ' minutes')::INTERVAL,
                    RANDOM() > 0.3);
            ELSE
                INSERT INTO alerts (vehicle_id, driver_id, type, severity, title, message, location, occurred_at, is_read)
                VALUES (v_id, d_id, 'offline', 'critical',
                    'Vehicle Signal Lost',
                    'GPS signal lost for more than 10 minutes',
                    ST_SetSRID(ST_MakePoint(a_lng, a_lat), 4326),
                    NOW() - (a_mins || ' minutes')::INTERVAL,
                    RANDOM() > 0.1);
        END CASE;
    END LOOP;

    -- 2 unresolved SOS alerts
    INSERT INTO alerts (vehicle_id, driver_id, type, severity, title, message, location, occurred_at, is_read)
    SELECT
        (SELECT id FROM vehicles WHERE status = 'active' ORDER BY RANDOM() LIMIT 1),
        (SELECT id FROM drivers  WHERE status = 'active' ORDER BY RANDOM() LIMIT 1),
        'sos', 'critical',
        'SOS Emergency Alert',
        'Driver has triggered emergency SOS button — immediate response required',
        ST_SetSRID(ST_MakePoint(74.34 + RANDOM()*0.05, 31.50 + RANDOM()*0.05), 4326),
        NOW() - (FLOOR(RANDOM() * 30) || ' minutes')::INTERVAL,
        FALSE
    FROM generate_series(1,2);
END $$;

-- ── 7i. Maintenance records ────────────────────────────────

DO $$ BEGIN RAISE NOTICE '    -> maintenance records...'; END $$;

DO $$
DECLARE
    v_ids UUID[];
    u_id  UUID;
BEGIN
    SELECT ARRAY(SELECT id FROM vehicles ORDER BY registration) INTO v_ids;
    SELECT id INTO u_id FROM users WHERE role = 'admin' LIMIT 1;

    -- Past completed services
    INSERT INTO maintenance (vehicle_id, type, description, status, priority,
        scheduled_date, completed_date, odometer_at, cost, parts_cost, labour_cost,
        technician, workshop, invoice_ref, ai_predicted)
    SELECT
        v_ids[1 + FLOOR(RANDOM() * array_length(v_ids,1))::INT],
        (ARRAY['oil_change','brake_service','tire_rotation','full_service','battery']::maintenance_type[])[FLOOR(1+RANDOM()*5)::INT],
        'Routine scheduled maintenance',
        'completed',
        'normal',
        CURRENT_DATE - (FLOOR(30+RANDOM()*300)||' days')::INTERVAL,
        CURRENT_DATE - (FLOOR(30+RANDOM()*300)||' days')::INTERVAL,
        50000 + FLOOR(RANDOM()*100000)::NUMERIC,
        3000 + FLOOR(RANDOM()*12000)::NUMERIC,
        1500 + FLOOR(RANDOM()*6000)::NUMERIC,
        1500 + FLOOR(RANDOM()*6000)::NUMERIC,
        (ARRAY['Arif Hussain','Tariq Motors','Ali Autos','FastFix Workshop'])[FLOOR(1+RANDOM()*4)::INT],
        (ARRAY['Gulberg Auto','DHA Workshop','Raiwind Service Center'])[FLOOR(1+RANDOM()*3)::INT],
        'INV-' || LPAD(FLOOR(10000+RANDOM()*90000)::TEXT, 5, '0'),
        RANDOM() > 0.8
    FROM generate_series(1, 25);

    -- Upcoming scheduled maintenance
    INSERT INTO maintenance (vehicle_id, type, description, status, priority,
        scheduled_date, cost, technician, workshop, ai_predicted, ai_confidence, created_by)
    VALUES
        (v_ids[1], 'oil_change',    'Engine oil + filter change (10W-40)',    'scheduled','normal',  CURRENT_DATE + 6,  4500, 'Arif Hussain', 'Gulberg Auto',   FALSE, NULL, u_id),
        (v_ids[2], 'brake_service', 'Front brake pads replacement',           'scheduled','high',    CURRENT_DATE + 8,  8200, 'Tariq Motors',  'DHA Workshop',   TRUE,  0.91, u_id),
        (v_ids[3], 'tire_rotation', 'Rotate + balance all 4 tyres',           'scheduled','normal',  CURRENT_DATE + 12, 2800, 'Ali Autos',     'Raiwind SC',     FALSE, NULL, u_id),
        (v_ids[4], 'battery',       'Battery voltage drop — AI predicted',    'scheduled','critical',CURRENT_DATE + 3,  6500, 'Arif Hussain', 'Gulberg Auto',   TRUE,  0.95, u_id),
        (v_ids[5], 'full_service',  '60,000 km major service',                'scheduled','normal',  CURRENT_DATE + 18, 18500,'Tariq Motors',  'DHA Workshop',   FALSE, NULL, u_id),
        (v_ids[6], 'oil_change',    'Oil change + coolant top-up',            'scheduled','normal',  CURRENT_DATE + 21, 4200, 'Ali Autos',     'Raiwind SC',     FALSE, NULL, u_id),
        (v_ids[7], 'brake_service', 'Rear brake drums worn — AI predicted',   'scheduled','high',    CURRENT_DATE + 5,  9100, 'Arif Hussain', 'Gulberg Auto',   TRUE,  0.87, u_id),
        (v_ids[1], 'inspection',    'Annual roadworthiness inspection',        'scheduled','normal',  CURRENT_DATE + 30, 1200, 'NTRC Inspector','Govt Test Center',FALSE,NULL, u_id);

    -- 1 in-progress
    INSERT INTO maintenance (vehicle_id, type, description, status, priority,
        scheduled_date, odometer_at, technician, workshop, created_by)
    VALUES
        (v_ids[10], 'transmission', 'Gearbox oil service + clutch inspection',
         'in_progress', 'high', CURRENT_DATE, 138000, 'Tariq Motors', 'DHA Workshop', u_id);
END $$;

-- ── 7j. Driver safety scores (last 30 days) ───────────────

DO $$ BEGIN RAISE NOTICE '    -> driver safety scores...'; END $$;

DO $$
DECLARE
    d_rec    RECORD;
    ds_day   DATE;
    ds_base  NUMERIC;
    ds_score NUMERIC;
    ds_spd   INTEGER;
    ds_brk   INTEGER;
    ds_acc   INTEGER;
BEGIN
    FOR d_rec IN SELECT id, safety_score FROM drivers WHERE status = 'active' LOOP
        ds_base := d_rec.safety_score;
        FOR ds_day IN
            SELECT generate_series::DATE
            FROM generate_series(CURRENT_DATE - 29, CURRENT_DATE, '1 day')
        LOOP
            -- Vary score ±8 around base with slight daily randomness
            ds_score := GREATEST(0, LEAST(100,
                ds_base + (RANDOM() - 0.5) * 16
                        + SIN(EXTRACT(DOW FROM ds_day)) * 3
            ));
            ds_spd := CASE WHEN ds_base < 70 THEN FLOOR(RANDOM()*4)::INT
                            WHEN ds_base < 85 THEN FLOOR(RANDOM()*2)::INT
                            ELSE 0 END;
            ds_brk := CASE WHEN ds_base < 75 THEN FLOOR(RANDOM()*3)::INT
                            ELSE FLOOR(RANDOM()*1.5)::INT END;
            ds_acc := FLOOR(RANDOM() * 2)::INT;

            INSERT INTO driver_scores (
                driver_id, period_date, period_type,
                overall_score, speed_score, braking_score,
                cornering_score, fatigue_score, fuel_score,
                speeding_events, harsh_braking, harsh_acceleration,
                distance_km, driving_hours
            ) VALUES (
                d_rec.id, ds_day, 'daily',
                ROUND(ds_score::NUMERIC, 2),
                ROUND(LEAST(100, ds_score + (RANDOM()-0.5)*10)::NUMERIC, 2),
                ROUND(LEAST(100, ds_score + (RANDOM()-0.5)*8)::NUMERIC, 2),
                ROUND(LEAST(100, ds_score + (RANDOM()-0.5)*8)::NUMERIC, 2),
                ROUND(LEAST(100, ds_score + (RANDOM()-0.5)*6)::NUMERIC, 2),
                ROUND(LEAST(100, ds_score + (RANDOM()-0.5)*6)::NUMERIC, 2),
                ds_spd, ds_brk, ds_acc,
                ROUND((80 + RANDOM()*200)::NUMERIC, 2),
                ROUND((2 + RANDOM()*8)::NUMERIC, 2)
            )
            ON CONFLICT (driver_id, period_date, period_type) DO NOTHING;
        END LOOP;
    END LOOP;
END $$;

DO $$ BEGIN RAISE NOTICE '    [OK] All test data inserted'; END $$;

-- ──────────────────────────────────────────────────────────
-- 8. ROW COUNTS & VERIFICATION
-- ──────────────────────────────────────────────────────────


DO $$ BEGIN RAISE NOTICE '[8] Verification - row counts:'; END $$;

SELECT
    'users'          AS table_name, COUNT(*) AS rows FROM users        UNION ALL
SELECT 'depots',                                      COUNT(*)          FROM depots       UNION ALL
SELECT 'drivers',                                     COUNT(*)          FROM drivers      UNION ALL
SELECT 'vehicles',                                    COUNT(*)          FROM vehicles     UNION ALL
SELECT 'geofences',                                   COUNT(*)          FROM geofences    UNION ALL
SELECT 'telemetry',                                   COUNT(*)          FROM telemetry    UNION ALL
SELECT 'trips',                                       COUNT(*)          FROM trips        UNION ALL
SELECT 'alerts',                                      COUNT(*)          FROM alerts       UNION ALL
SELECT 'maintenance',                                 COUNT(*)          FROM maintenance  UNION ALL
SELECT 'driver_scores',                               COUNT(*)          FROM driver_scores
ORDER BY 1;


DO $$ BEGIN RAISE NOTICE '[8] Spatial index verification:'; END $$;

SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE indexdef ILIKE '%gist%'
  AND tablename IN ('vehicles','telemetry','trips','geofences','alerts','depots')
ORDER BY tablename, indexname;


DO $$ BEGIN RAISE NOTICE '[8] Fleet KPI snapshot:'; END $$;

SELECT * FROM fleet_kpi_snapshot();


DO $$ BEGIN RAISE NOTICE '[8] Vehicle status breakdown:'; END $$;

SELECT status, COUNT(*) AS count,
       ROUND(AVG(current_speed),1)   AS avg_speed,
       ROUND(AVG(current_fuel),1)    AS avg_fuel_pct,
       ROUND(AVG(health_score),1)    AS avg_health
FROM vehicles
GROUP BY status
ORDER BY count DESC;


DO $$ BEGIN RAISE NOTICE '[8] Driver leaderboard (top 5):'; END $$;

SELECT rank, full_name, current_score, vehicle_reg, vehicle_status
FROM v_driver_leaderboard
ORDER BY rank
LIMIT 5;


DO $$ BEGIN RAISE NOTICE '[8] Geofence vehicle containment (PostGIS ST_Within):'; END $$;

SELECT
    g.name                   AS geofence,
    g.zone_type,
    COUNT(v.id)              AS vehicles_inside
FROM geofences g
LEFT JOIN vehicles v
    ON ST_Within(v.current_location, g.boundary)
   AND v.current_location IS NOT NULL
GROUP BY g.name, g.zone_type
ORDER BY vehicles_inside DESC;


DO $$ BEGIN RAISE NOTICE '[8] Recent vehicle trails (PostGIS ST_MakeLine):'; END $$;

SELECT
    v.registration,
    COUNT(t.id)                                           AS telemetry_points,
    ROUND(ST_Length(
        ST_MakeLine(t.location ORDER BY t.recorded_at)::geography
    )::NUMERIC / 1000, 2)                                 AS trail_km,
    MIN(t.recorded_at)                                    AS from_time,
    MAX(t.recorded_at)                                    AS to_time
FROM vehicles v
JOIN telemetry t ON t.vehicle_id = v.id
WHERE t.recorded_at > NOW() - INTERVAL '2 hours'
GROUP BY v.id, v.registration
HAVING COUNT(t.id) > 5
ORDER BY trail_km DESC
LIMIT 8;


DO $$ BEGIN RAISE NOTICE '[8] Alert heatmap sample (ST_SnapToGrid):'; END $$;

SELECT
    ROUND(ST_X(ST_SnapToGrid(location, 0.01))::NUMERIC, 3) AS grid_lng,
    ROUND(ST_Y(ST_SnapToGrid(location, 0.01))::NUMERIC, 3) AS grid_lat,
    COUNT(*)                                                AS alert_count,
    STRING_AGG(DISTINCT type::TEXT, ', ')                  AS alert_types
FROM alerts
WHERE location IS NOT NULL
GROUP BY ST_SnapToGrid(location, 0.01)
ORDER BY alert_count DESC
LIMIT 8;


DO $$ BEGIN RAISE NOTICE '[8] Vehicles near Gulberg (ST_DWithin, radius=3km):'; END $$;

SELECT registration, vehicle_name, status, driver_name,
       ROUND(distance_m::NUMERIC) AS dist_m
FROM vehicles_near_point(74.345, 31.512, 3000)
LIMIT 6;


DO $$ BEGIN RAISE NOTICE '[8] Upcoming maintenance (AI-predicted first):'; END $$;

SELECT
    v.registration,
    m.type,
    m.priority,
    m.scheduled_date,
    m.scheduled_date - CURRENT_DATE AS days_away,
    m.cost,
    CASE WHEN m.ai_predicted THEN '✓ AI' ELSE 'Manual' END AS source
FROM maintenance m
JOIN vehicles v ON m.vehicle_id = v.id
WHERE m.status = 'scheduled'
ORDER BY m.ai_predicted DESC, m.scheduled_date ASC
LIMIT 10;

-- ──────────────────────────────────────────────────────────
-- DONE
-- ──────────────────────────────────────────────────────────


DO $$ BEGIN RAISE NOTICE '======================================================'; END $$;
DO $$ BEGIN RAISE NOTICE '  [OK] CloudNext Fleet DB bootstrap complete!'; END $$;

DO $$ BEGIN RAISE NOTICE '  Login credentials:'; END $$;
DO $$ BEGIN RAISE NOTICE '    admin@cloudnext.com     / admin123'; END $$;
DO $$ BEGIN RAISE NOTICE '    operator@cloudnext.com  / admin123'; END $$;
DO $$ BEGIN RAISE NOTICE '    viewer@cloudnext.com    / admin123'; END $$;

DO $$ BEGIN RAISE NOTICE '  Quick API test:'; END $$;
DO $$ BEGIN RAISE NOTICE '    curl -s -X POST http://localhost:3001/api/auth/login \'; END $$;
DO $$ BEGIN RAISE NOTICE '      -H "Content-Type: application/json" \'; END $$;
DO $$ BEGIN RAISE NOTICE '      -d "{\"email\":\"admin@cloudnext.com\",\"password\":\"admin123\"}"'; END $$;
DO $$ BEGIN RAISE NOTICE '======================================================'; END $$;

