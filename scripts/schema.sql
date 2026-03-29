-- ============================================================
-- CloudNext Fleet Management System — PostGIS Schema
-- Run: psql -U postgres -d fleet_db -f schema.sql
-- ============================================================

-- Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- for fuzzy text search

-- ── ENUMS ──────────────────────────────────────────────────

CREATE TYPE vehicle_status AS ENUM ('active', 'idle', 'offline', 'maintenance', 'alert');
CREATE TYPE vehicle_type   AS ENUM ('truck', 'van', 'car', 'bus', 'motorcycle', 'heavy');
CREATE TYPE alert_severity AS ENUM ('critical', 'warning', 'info');
CREATE TYPE alert_type     AS ENUM (
  'speeding', 'geofence_enter', 'geofence_exit', 'harsh_braking',
  'harsh_acceleration', 'idle_timeout', 'sos', 'low_fuel',
  'maintenance_due', 'offline', 'fatigue'
);
CREATE TYPE driver_status AS ENUM ('active', 'inactive', 'on_leave', 'suspended');
CREATE TYPE trip_status   AS ENUM ('planned', 'active', 'completed', 'cancelled');

-- ── USERS (operators/admins) ────────────────────────────────

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name     VARCHAR(255) NOT NULL,
  role          VARCHAR(50) NOT NULL DEFAULT 'operator',  -- admin | operator | viewer
  is_active     BOOLEAN NOT NULL DEFAULT true,
  last_login    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── DEPOTS ─────────────────────────────────────────────────

CREATE TABLE depots (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(255) NOT NULL,
  address     TEXT,
  location    GEOMETRY(Point, 4326) NOT NULL,  -- PostGIS point
  capacity    INTEGER DEFAULT 50,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_depots_location ON depots USING GIST(location);

-- ── DRIVERS ────────────────────────────────────────────────

CREATE TABLE drivers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id     VARCHAR(50) UNIQUE NOT NULL,
  full_name       VARCHAR(255) NOT NULL,
  phone           VARCHAR(50),
  email           VARCHAR(255),
  license_number  VARCHAR(100) UNIQUE NOT NULL,
  license_expiry  DATE NOT NULL,
  status          driver_status NOT NULL DEFAULT 'active',
  safety_score    NUMERIC(5,2) DEFAULT 100.00,
  total_distance  NUMERIC(12,2) DEFAULT 0,   -- km
  total_trips     INTEGER DEFAULT 0,
  depot_id        UUID REFERENCES depots(id),
  photo_url       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── VEHICLES ───────────────────────────────────────────────

CREATE TABLE vehicles (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  registration      VARCHAR(50) UNIQUE NOT NULL,
  make              VARCHAR(100) NOT NULL,
  model             VARCHAR(100) NOT NULL,
  year              INTEGER NOT NULL,
  type              vehicle_type NOT NULL DEFAULT 'truck',
  status            vehicle_status NOT NULL DEFAULT 'offline',
  color             VARCHAR(50),
  vin               VARCHAR(100) UNIQUE,

  -- Current telemetry (live)
  current_location  GEOMETRY(Point, 4326),
  current_speed     NUMERIC(6,2) DEFAULT 0,        -- km/h
  current_heading   NUMERIC(6,2) DEFAULT 0,         -- degrees
  current_fuel      NUMERIC(5,2) DEFAULT 100,        -- percent
  current_odometer  NUMERIC(12,2) DEFAULT 0,         -- km
  engine_on         BOOLEAN DEFAULT false,

  -- Specs
  fuel_capacity     NUMERIC(8,2) DEFAULT 60,         -- litres
  fuel_efficiency   NUMERIC(6,2) DEFAULT 10,         -- L/100km
  max_speed         NUMERIC(6,2) DEFAULT 120,
  payload_capacity  NUMERIC(10,2),                    -- kg

  -- Relations
  assigned_driver_id UUID REFERENCES drivers(id),
  depot_id           UUID REFERENCES depots(id),

  -- Maintenance
  last_service_date  DATE,
  next_service_km    NUMERIC(12,2),
  health_score       NUMERIC(5,2) DEFAULT 100,

  last_seen          TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vehicles_location  ON vehicles USING GIST(current_location);
CREATE INDEX idx_vehicles_status    ON vehicles(status);
CREATE INDEX idx_vehicles_driver    ON vehicles(assigned_driver_id);

-- ── TELEMETRY (time-series, append-only) ────────────────────

CREATE TABLE telemetry (
  id              BIGSERIAL PRIMARY KEY,
  vehicle_id      UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  location        GEOMETRY(Point, 4326) NOT NULL,
  speed           NUMERIC(6,2) DEFAULT 0,
  heading         NUMERIC(6,2) DEFAULT 0,
  fuel_level      NUMERIC(5,2),
  odometer        NUMERIC(12,2),
  engine_on       BOOLEAN DEFAULT true,
  rpm             INTEGER,
  battery_voltage NUMERIC(5,2),
  satellites      SMALLINT,
  accuracy        NUMERIC(8,2),   -- GPS accuracy in metres
  altitude        NUMERIC(8,2)    -- metres
);

CREATE INDEX idx_telemetry_vehicle_time ON telemetry(vehicle_id, recorded_at DESC);
CREATE INDEX idx_telemetry_location     ON telemetry USING GIST(location);
CREATE INDEX idx_telemetry_time         ON telemetry(recorded_at DESC);

-- Partition hint: in production, partition by recorded_at (monthly)

-- ── TRIPS ──────────────────────────────────────────────────

CREATE TABLE trips (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id      UUID NOT NULL REFERENCES vehicles(id),
  driver_id       UUID REFERENCES drivers(id),
  status          trip_status NOT NULL DEFAULT 'planned',

  origin          GEOMETRY(Point, 4326),
  destination     GEOMETRY(Point, 4326),
  origin_address  TEXT,
  dest_address    TEXT,
  route_path      GEOMETRY(LineString, 4326),   -- actual driven path
  planned_path    GEOMETRY(LineString, 4326),   -- planned route

  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  planned_start   TIMESTAMPTZ,
  planned_end     TIMESTAMPTZ,

  distance_km     NUMERIC(10,2) DEFAULT 0,
  duration_mins   INTEGER DEFAULT 0,
  avg_speed       NUMERIC(6,2),
  fuel_used       NUMERIC(8,2),
  max_speed       NUMERIC(6,2),
  idle_time_mins  INTEGER DEFAULT 0,
  harsh_events    INTEGER DEFAULT 0,

  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_trips_vehicle   ON trips(vehicle_id);
CREATE INDEX idx_trips_driver    ON trips(driver_id);
CREATE INDEX idx_trips_status    ON trips(status);
CREATE INDEX idx_trips_started   ON trips(started_at DESC);
CREATE INDEX idx_trips_origin    ON trips USING GIST(origin);
CREATE INDEX idx_trips_dest      ON trips USING GIST(destination);

-- ── GEOFENCES ──────────────────────────────────────────────

CREATE TABLE geofences (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  boundary    GEOMETRY(Polygon, 4326) NOT NULL,   -- PostGIS polygon
  color       VARCHAR(20) DEFAULT '#00d4e8',
  is_active   BOOLEAN NOT NULL DEFAULT true,
  alert_on_enter BOOLEAN DEFAULT true,
  alert_on_exit  BOOLEAN DEFAULT true,
  speed_limit    NUMERIC(6,2),                     -- optional speed limit inside
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_geofences_boundary ON geofences USING GIST(boundary);

-- ── ALERTS ─────────────────────────────────────────────────

CREATE TABLE alerts (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id  UUID REFERENCES vehicles(id),
  driver_id   UUID REFERENCES drivers(id),
  trip_id     UUID REFERENCES trips(id),
  geofence_id UUID REFERENCES geofences(id),

  type        alert_type NOT NULL,
  severity    alert_severity NOT NULL DEFAULT 'warning',
  title       VARCHAR(255) NOT NULL,
  message     TEXT,
  location    GEOMETRY(Point, 4326),
  speed       NUMERIC(6,2),

  is_read     BOOLEAN DEFAULT false,
  is_resolved BOOLEAN DEFAULT false,
  resolved_by UUID REFERENCES users(id),
  resolved_at TIMESTAMPTZ,

  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alerts_vehicle    ON alerts(vehicle_id);
CREATE INDEX idx_alerts_type       ON alerts(type);
CREATE INDEX idx_alerts_severity   ON alerts(severity);
CREATE INDEX idx_alerts_occurred   ON alerts(occurred_at DESC);
CREATE INDEX idx_alerts_unread     ON alerts(is_read) WHERE is_read = false;
CREATE INDEX idx_alerts_location   ON alerts USING GIST(location);

-- ── DRIVER BEHAVIOUR SCORES ─────────────────────────────────

CREATE TABLE driver_scores (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id       UUID NOT NULL REFERENCES drivers(id),
  trip_id         UUID REFERENCES trips(id),
  period_date     DATE NOT NULL,

  overall_score   NUMERIC(5,2),
  speed_score     NUMERIC(5,2),
  braking_score   NUMERIC(5,2),
  cornering_score NUMERIC(5,2),
  fatigue_score   NUMERIC(5,2),
  fuel_score      NUMERIC(5,2),

  speeding_events     INTEGER DEFAULT 0,
  harsh_braking       INTEGER DEFAULT 0,
  harsh_acceleration  INTEGER DEFAULT 0,
  sharp_cornering     INTEGER DEFAULT 0,

  distance_km     NUMERIC(10,2),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scores_driver ON driver_scores(driver_id);
CREATE INDEX idx_scores_date   ON driver_scores(period_date DESC);

-- ── MAINTENANCE RECORDS ─────────────────────────────────────

CREATE TABLE maintenance (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id      UUID NOT NULL REFERENCES vehicles(id),
  type            VARCHAR(100) NOT NULL,  -- oil_change, brake_service, tire_rotation...
  description     TEXT,
  status          VARCHAR(50) DEFAULT 'scheduled',  -- scheduled | in_progress | completed
  scheduled_date  DATE,
  completed_date  DATE,
  odometer_at     NUMERIC(12,2),
  cost            NUMERIC(10,2),
  technician      VARCHAR(255),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_maintenance_vehicle ON maintenance(vehicle_id);
CREATE INDEX idx_maintenance_status  ON maintenance(status);
CREATE INDEX idx_maintenance_date    ON maintenance(scheduled_date);

-- ── PostGIS SPATIAL VIEWS ───────────────────────────────────

-- Live fleet view (vehicles with coordinates as GeoJSON)
CREATE OR REPLACE VIEW v_fleet_live AS
SELECT
  v.id,
  v.registration,
  v.make || ' ' || v.model AS vehicle_name,
  v.type,
  v.status,
  v.current_speed,
  v.current_heading,
  v.current_fuel,
  v.current_odometer,
  v.engine_on,
  v.health_score,
  v.last_seen,
  ST_AsGeoJSON(v.current_location)::json AS location_geojson,
  ST_X(v.current_location) AS longitude,
  ST_Y(v.current_location) AS latitude,
  d.id AS driver_id,
  d.full_name AS driver_name,
  d.safety_score AS driver_score,
  dp.name AS depot_name
FROM vehicles v
LEFT JOIN drivers d  ON v.assigned_driver_id = d.id
LEFT JOIN depots dp  ON v.depot_id = dp.id;

-- Geofence violations view
CREATE OR REPLACE VIEW v_geofence_violations AS
SELECT
  a.id AS alert_id,
  a.occurred_at,
  a.type,
  v.registration,
  g.name AS geofence_name,
  ST_AsGeoJSON(a.location)::json AS location_geojson
FROM alerts a
JOIN vehicles v   ON a.vehicle_id = v.id
JOIN geofences g  ON a.geofence_id = g.id
WHERE a.type IN ('geofence_enter', 'geofence_exit')
ORDER BY a.occurred_at DESC;

-- ── FUNCTIONS ───────────────────────────────────────────────

-- Check if a vehicle is inside any geofence
CREATE OR REPLACE FUNCTION get_vehicle_geofences(v_id UUID)
RETURNS TABLE(geofence_id UUID, geofence_name VARCHAR, is_inside BOOLEAN) AS $$
  SELECT
    g.id,
    g.name,
    ST_Within(
      (SELECT current_location FROM vehicles WHERE id = v_id),
      g.boundary
    ) AS is_inside
  FROM geofences g
  WHERE g.is_active = true;
$$ LANGUAGE SQL STABLE;

-- Get vehicles within radius (metres)
CREATE OR REPLACE FUNCTION vehicles_near_point(
  lng FLOAT, lat FLOAT, radius_m FLOAT
)
RETURNS TABLE(vehicle_id UUID, distance_m FLOAT) AS $$
  SELECT
    id,
    ST_Distance(
      current_location::geography,
      ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
    ) AS distance_m
  FROM vehicles
  WHERE current_location IS NOT NULL
    AND ST_DWithin(
      current_location::geography,
      ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
      radius_m
    )
  ORDER BY distance_m;
$$ LANGUAGE SQL STABLE;

-- Updated timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at     BEFORE UPDATE ON users     FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_vehicles_updated_at  BEFORE UPDATE ON vehicles  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_drivers_updated_at   BEFORE UPDATE ON drivers   FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_trips_updated_at     BEFORE UPDATE ON trips     FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_geofences_updated_at BEFORE UPDATE ON geofences FOR EACH ROW EXECUTE FUNCTION update_updated_at();
