# CloudNext Fleet Management — Setup Guide

## Prerequisites

| Requirement | Version | Download |
|---|---|---|
| Node.js | 18 or 20 LTS | https://nodejs.org |
| PostgreSQL | 15 or 16 | https://www.postgresql.org/download/windows/ |
| PostGIS | 3.3+ | Bundled in PostgreSQL installer (Stack Builder) |
| Git | any | https://git-scm.com |

---

## Step 1 — Install PostgreSQL + PostGIS on Windows

1. Download the PostgreSQL Windows installer from https://www.postgresql.org/download/windows/
2. During installation, **tick "Stack Builder"** at the end
3. In Stack Builder → select your PostgreSQL version → expand **Spatial Extensions** → tick **PostGIS**
4. Complete the PostGIS install. Remember the password you set for the `postgres` user.

**Verify PostGIS is available:**
```sql
-- Open pgAdmin or psql, then run:
SELECT PostGIS_Version();
-- Should return something like: 3.4.0 r...
```

---

## Step 2 — Create the database

Open **psql** (Start → PostgreSQL → SQL Shell) or **pgAdmin** and run:

```sql
CREATE DATABASE fleet_db;
\c fleet_db
CREATE EXTENSION IF NOT EXISTS postgis;
SELECT PostGIS_Version();   -- must return a version string
```

Or use the command line (replace `your_password`):
```bat
psql -U postgres -c "CREATE DATABASE fleet_db;"
psql -U postgres -d fleet_db -c "CREATE EXTENSION postgis;"
```

---

## Step 3 — Clone and configure

```bat
git clone https://github.com/your-org/fleet-app.git
cd fleet-app
```

**Configure backend:**
```bat
copy backend\.env.example backend\.env
notepad backend\.env
```

Edit these lines in `backend\.env`:
```
DB_PASSWORD=your_postgres_password_here
JWT_SECRET=any_long_random_string_like_this_abc123xyz789
```

**Configure frontend:**
```bat
copy frontend\.env.example frontend\.env
notepad frontend\.env
```

Edit this line — get a free token at https://account.mapbox.com/access-tokens/
```
VITE_MAPBOX_TOKEN=pk.eyJ1...your_actual_token
```

---

## Step 4 — Install dependencies

**Important on Windows: install each package separately, NOT from the root.**

```bat
:: Root (just for concurrently)
npm install

:: Backend
cd backend
npm install
cd ..

:: Frontend
cd frontend
npm install
cd ..
```

> ⚠️ Do NOT use `npm install` with `--workspaces` from the root on Windows — it causes
> Vite module resolution conflicts. Always install inside each subdirectory.

---

## Step 5 — Run the database bootstrap script

This creates all tables, indexes, functions, views, and inserts test data:

```bat
psql -U postgres -d fleet_db -f fleet_complete.sql
```

You should see output ending with:
```
✓ CloudNext Fleet DB bootstrap complete!
  Login credentials:
    admin@cloudnext.com    / admin123
    operator@cloudnext.com / admin123
```

---

## Step 6 — Start the application

**Option A — Start both servers together (from the project root):**
```bat
npm run dev
```

**Option B — Start them in separate terminals (recommended on Windows):**

Terminal 1 (Backend):
```bat
cd backend
npm run dev
```

Terminal 2 (Frontend):
```bat
cd frontend
npm run dev
```

Then open: **http://localhost:5173**

Login: `admin@cloudnext.com` / `admin123`

---

## Troubleshooting

### ❌ "Cannot find module 'vite'"

**Cause:** npm workspace hoisting put `@vitejs/plugin-react` in the wrong `node_modules`.

**Fix:** Delete all `node_modules` and reinstall inside each subdirectory:
```bat
:: Delete all node_modules
rmdir /s /q node_modules
rmdir /s /q backend\node_modules
rmdir /s /q frontend\node_modules

:: Reinstall in each folder separately
cd backend
npm install
cd ..\frontend
npm install
cd ..
npm install
```

### ❌ "function postgis_version() does not exist"

**Cause:** PostGIS extension is not enabled in your `fleet_db` database.

**Fix:**
```bat
psql -U postgres -d fleet_db -c "CREATE EXTENSION IF NOT EXISTS postgis;"
```

Then restart the backend.

### ❌ "password authentication failed for user postgres"

**Fix:** Update `DB_PASSWORD` in `backend\.env` to match the password you set when installing PostgreSQL.

### ❌ "ECONNREFUSED 127.0.0.1:5432"

**Cause:** PostgreSQL service is not running.

**Fix:** Open Windows Services (Win+R → `services.msc`) and start `postgresql-x64-16`.

Or from command line:
```bat
net start postgresql-x64-16
```

### ❌ Map shows blank / "Mapbox token invalid"

**Fix:** Get a free token at https://account.mapbox.com/access-tokens/ and update `VITE_MAPBOX_TOKEN` in `frontend\.env`. Restart the frontend dev server after saving.

### ❌ Backend crashes immediately after starting

Check the backend terminal for the error. Common causes:
1. Wrong DB credentials in `backend\.env`
2. PostgreSQL not running
3. PostGIS not installed

The server will now **retry the DB connection 5 times** before giving up, so watch the terminal output.

---

## Ports

| Service | Port | URL |
|---|---|---|
| Frontend (Vite) | 5173 | http://localhost:5173 |
| Backend API | 3001 | http://localhost:3001/api |
| WebSocket | 3001 | ws://localhost:3001/ws |
| PostgreSQL | 5432 | localhost:5432 |

---

## Quick health checks

```bat
:: Is the backend running?
curl http://localhost:3001/api/health

:: Is the DB connected?
:: (watch the backend terminal — it shows DB status on startup)

:: Is PostGIS installed?
psql -U postgres -d fleet_db -c "SELECT PostGIS_Version();"
```
