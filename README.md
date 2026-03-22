# CloudNext Fleet Management System

> AI-powered, real-time fleet tracking built on **React · DeckGL · Mapbox · Node.js · PostgreSQL + PostGIS**

---

## ✦ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18 + TypeScript, DeckGL 8.9, react-map-gl 7, Mapbox GL JS 3 |
| **State** | Zustand |
| **Charts** | Recharts |
| **Backend** | Node.js 20, Express 4, WebSocket (ws) |
| **Database** | PostgreSQL 16 + PostGIS 3.4 |
| **Auth** | JWT (jsonwebtoken + bcryptjs) |
| **Realtime** | WebSocket broadcast + vehicle simulator |
| **DevOps** | Docker Compose, multi-service orchestration |

---

## ✦ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    React Frontend (Vite)                  │
│                                                           │
│   ┌──────────────┐  ┌──────────────────────────────────┐ │
│   │   Sidebar     │  │         DeckGL + Mapbox Map       │ │
│   │  ─────────── │  │                                   │ │
│   │  VehicleList  │  │  ScatterplotLayer (vehicles)     │ │
│   │  VehicleDet.  │  │  IconLayer       (headings)      │ │
│   │  AlertsFeed   │  │  PathLayer       (trails)        │ │
│   │  DriversTable │  │  PolygonLayer    (geofences)     │ │
│   │  Analytics    │  │  HeatmapLayer    (alert heat)    │ │
│   └──────────────┘  │  TextLayer       (speed labels)  │ │
│                      └──────────────────────────────────┘ │
│                                                           │
│          Zustand Store ←── WebSocket (/ws)                │
└───────────────────────────────┬─────────────────────────┘
                                │ REST /api  +  WS /ws
┌───────────────────────────────▼─────────────────────────┐
│                   Node.js + Express                       │
│                                                           │
│  /api/vehicles     /api/alerts     /api/geofences         │
│  /api/drivers      /api/analytics  /api/auth              │
│                                                           │
│  Vehicle Simulator ──► tick() every 3s ──► DB + WS bcast │
└───────────────────────────────┬─────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────┐
│              PostgreSQL 16 + PostGIS 3.4                  │
│                                                           │
│  vehicles  drivers  telemetry  trips  alerts  geofences   │
│                                                           │
│  ST_Within()  ST_DWithin()  ST_MakeLine()                 │
│  ST_AsGeoJSON()  ST_Distance()  ST_SnapToGrid()           │
└─────────────────────────────────────────────────────────┘
```

---

## ✦ Quick Start

### Prerequisites
- Node.js 20+
- Docker + Docker Compose
- Mapbox account (free tier works) → get token at mapbox.com

### 1. Clone & configure

```bash
git clone <your-repo>
cd fleet-app

# Copy env files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Edit backend/.env — set your DB password
# Edit frontend/.env — set your MAPBOX_TOKEN
```

### 2. Start with Docker (recommended)

```bash
# Set your Mapbox token
export MAPBOX_TOKEN=pk.eyJ1IjoieW91c...

# Start all services (Postgres, Backend, Frontend)
docker compose up -d

# Watch logs
docker compose logs -f backend

# Open browser
open http://localhost:5173
```

Login: `admin@cloudnext.com` / `admin123`

### 3. Manual setup (without Docker)

```bash
# Start PostgreSQL with PostGIS (using Docker just for DB)
docker run -d \
  --name fleet_postgres \
  -e POSTGRES_PASSWORD=fleet_secret_2024 \
  -e POSTGRES_DB=fleet_db \
  -p 5432:5432 \
  postgis/postgis:16-3.4

# Install dependencies
npm install            # root (installs concurrently)
cd backend && npm install
cd ../frontend && npm install

# Run DB migration + seed
cd backend
cp .env.example .env  # edit DB_PASSWORD
npm run migrate
npm run seed

# Start both servers concurrently from root
cd ..
npm run dev
```

---

## ✦ Project Structure

```
fleet-app/
├── docker-compose.yml
├── package.json               ← monorepo workspace root
│
├── backend/
│   ├── src/
│   │   ├── index.js           ← Express server + HTTP + WebSocket
│   │   ├── db.js              ← PostgreSQL pool (pg)
│   │   ├── middleware/
│   │   │   └── auth.js        ← JWT middleware
│   │   ├── routes/
│   │   │   ├── vehicles.js    ← CRUD + PostGIS spatial queries
│   │   │   └── index.js       ← alerts, geofences, drivers, analytics, auth
│   │   ├── services/
│   │   │   ├── simulator.js   ← Live vehicle movement engine
│   │   │   └── websocket.js   ← WS broadcast server
│   │   ├── migrations/
│   │   │   └── schema.sql     ← Full PostGIS schema + spatial indexes
│   │   └── seeds/run.js       ← 12 vehicles, 12 drivers, Lahore geofences
│   └── .env.example
│
└── frontend/
    └── src/
        ├── types/index.ts     ← TypeScript domain types
        ├── services/api.ts    ← Axios instance with JWT interceptor
        ├── store/
        │   ├── fleetStore.ts  ← Zustand: vehicles, alerts, map state, WS
        │   └── authStore.ts   ← Auth state + login/logout
        ├── utils/colors.ts    ← Status colors + formatters
        ├── components/
        │   ├── map/
        │   │   ├── FleetMap.tsx    ← DeckGL layers over Mapbox
        │   │   └── MapControls.tsx ← Toggle geofences/heatmap/trails
        │   ├── common/
        │   │   ├── Navbar.tsx      ← Top bar with live KPIs
        │   │   └── Sidebar.tsx     ← Tabbed sidebar container
        │   ├── vehicles/
        │   │   ├── VehicleList.tsx ← Searchable, filterable list
        │   │   └── VehicleDetail.tsx ← Live telemetry + history
        │   ├── alerts/
        │   │   └── AlertsFeed.tsx  ← Real-time alert stream
        │   ├── drivers/
        │   │   └── DriversTable.tsx ← Safety leaderboard
        │   └── dashboard/
        │       └── AnalyticsPanel.tsx ← Recharts fuel/speed charts
        └── pages/
            ├── LoginPage.tsx
            └── DashboardPage.tsx
```

---

## ✦ Database Schema (PostGIS)

### Key tables

| Table | Purpose | PostGIS Type |
|---|---|---|
| `vehicles` | Fleet registry + live state | `GEOMETRY(Point, 4326)` |
| `telemetry` | Append-only time-series | `GEOMETRY(Point, 4326)` |
| `trips` | Journey records | `GEOMETRY(LineString, 4326)` |
| `geofences` | Zone boundaries | `GEOMETRY(Polygon, 4326)` |
| `alerts` | Event log | `GEOMETRY(Point, 4326)` |
| `depots` | Base locations | `GEOMETRY(Point, 4326)` |

### PostGIS queries used

```sql
-- Vehicles within 5km radius
SELECT id, ST_Distance(location::geography, ST_MakePoint(lng,lat)::geography) AS dist
FROM vehicles
WHERE ST_DWithin(location::geography, ST_MakePoint($1,$2)::geography, 5000);

-- Vehicle trail as GeoJSON LineString
SELECT ST_AsGeoJSON(ST_MakeLine(location ORDER BY recorded_at))
FROM telemetry WHERE vehicle_id = $1;

-- Geofence containment check
SELECT ST_Within(v.current_location, g.boundary) AS inside
FROM vehicles v CROSS JOIN geofences g;

-- Alert heatmap with grid snapping
SELECT ST_X(location), ST_Y(location), COUNT(*)
FROM alerts
GROUP BY ST_SnapToGrid(location, 0.005);
```

---

## ✦ REST API Reference

### Auth
```
POST   /api/auth/login        { email, password } → { token, user }
GET    /api/auth/me           → { user }
```

### Vehicles
```
GET    /api/vehicles          ?status=active&type=truck&search=
GET    /api/vehicles/geojson  → GeoJSON FeatureCollection for DeckGL
GET    /api/vehicles/nearby   ?lng=&lat=&radius=5000
GET    /api/vehicles/:id      → vehicle + alerts + trips + maintenance
GET    /api/vehicles/:id/telemetry  ?limit=100&since=ISO
GET    /api/vehicles/:id/trail      ?minutes=60 → GeoJSON LineString
PATCH  /api/vehicles/:id      { assigned_driver_id, depot_id, status }
```

### Alerts
```
GET    /api/alerts            ?severity=critical&type=speeding&unread=true
GET    /api/alerts/stats      → { unread, critical, warning, last_hour }
PATCH  /api/alerts/:id/read
PATCH  /api/alerts/read-all
```

### Geofences
```
GET    /api/geofences         → all geofences with polygon geometry
GET    /api/geofences/geojson → GeoJSON FeatureCollection
GET    /api/geofences/vehicle-status → vehicles inside each geofence
POST   /api/geofences         { name, coordinates[][], color, speed_limit }
DELETE /api/geofences/:id
```

### Drivers & Analytics
```
GET    /api/drivers           → drivers with vehicle + score
GET    /api/drivers/:id/scores → safety score history
GET    /api/analytics/fleet-summary
GET    /api/analytics/fuel-trend  ?days=7
GET    /api/analytics/alert-heatmap
```

### WebSocket (`ws://localhost:3001/ws`)
```json
// Server → Client (every 3s)
{ "type": "telemetry_batch", "vehicles": [{ "id", "lng", "lat", "speed", "heading", "fuel", "status" }] }

// Server → Client (on event)
{ "type": "alert", "alert": { "id", "type", "severity", "title", "vehicle_id" } }

// Client → Server
{ "type": "subscribe_vehicle", "vehicleId": "uuid" }
{ "type": "ping" }
```

---

## ✦ DeckGL Layers

| Layer | Data | Purpose |
|---|---|---|
| `PolygonLayer` | Geofences | Zone fill + outline |
| `PathLayer` | Telemetry trail | Vehicle history path |
| `HeatmapLayer` | Alert points | Incident density |
| `ScatterplotLayer` | Vehicles | Pulse rings + cores |
| `IconLayer` | Moving vehicles | Direction arrows |
| `TextLayer` | Active vehicles | Speed labels (zoom > 13) |

---

## ✦ Environment Variables

### Backend (`backend/.env`)
```
PORT=3001
DB_HOST=localhost
DB_PORT=5432
DB_NAME=fleet_db
DB_USER=postgres
DB_PASSWORD=your_password
JWT_SECRET=your_secret_key
SIMULATE_VEHICLES=true
SIMULATION_INTERVAL_MS=3000
```

### Frontend (`frontend/.env`)
```
VITE_MAPBOX_TOKEN=pk.eyJ1...your_mapbox_token
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001/ws
```

---

## ✦ Getting a Mapbox Token

1. Sign up at [mapbox.com](https://account.mapbox.com)
2. Go to Account → Tokens
3. Create a token with `styles:read` and `tiles:read` scopes
4. Copy and paste into `frontend/.env` as `VITE_MAPBOX_TOKEN`

The free tier includes 50,000 map loads/month — more than enough for development.

---

## ✦ Seed Data

The seed script creates realistic data for the Lahore, Pakistan region:

- **12 vehicles**: Isuzu NPR, Hino 300/500, Fuso Canter, Tata LPT, Toyota Hiace, Yutong bus, MAN TGS
- **12 drivers**: With varying safety scores (52–97) for realistic leaderboard
- **3 depots**: Raiwind Road, DHA Phase 5, Gulberg Central
- **4 geofences**: DHA Delivery Zone, Gulberg Commercial, Airport Restricted, Johar Town
- **20 seeded alerts**: Speeding, idle timeout, low fuel, harsh braking, geofence exit
- **Telemetry history**: 30 minutes of position history per active vehicle
- **Driver scores**: Per-driver safety scoring records

---

## ✦ License

MIT — CloudNext Technology Solutions 2026
