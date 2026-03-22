@echo off
setlocal enabledelayedexpansion

echo.
echo =====================================================
echo   CloudNext Fleet Management - Windows Setup
echo =====================================================
echo.

:: Check Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found. Download from https://nodejs.org
    pause & exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do set NODE_VER=%%i
echo [OK] Node.js %NODE_VER%

:: Check npm
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] npm not found.
    pause & exit /b 1
)

:: Check psql
psql --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARNING] psql not found in PATH.
    echo    Add PostgreSQL bin folder to PATH, e.g.:
    echo    C:\Program Files\PostgreSQL\16\bin
    echo.
)

:: ── Install dependencies ──────────────────────────────────
echo.
echo [1/4] Installing root dependencies...
call npm install
if %errorlevel% neq 0 goto :error

echo [2/4] Installing backend dependencies...
cd backend
call npm install
if %errorlevel% neq 0 (cd .. & goto :error)
cd ..

echo [3/4] Installing frontend dependencies...
cd frontend
call npm install
if %errorlevel% neq 0 (cd .. & goto :error)
cd ..

:: ── Copy .env files ───────────────────────────────────────
echo.
echo [4/4] Setting up environment files...
if not exist backend\.env (
    copy backend\.env.example backend\.env >nul
    echo    Created backend\.env  - EDIT THIS FILE with your DB password
) else (
    echo    backend\.env already exists (skipped)
)

if not exist frontend\.env (
    copy frontend\.env.example frontend\.env >nul
    echo    Created frontend\.env - EDIT THIS FILE with your Mapbox token
) else (
    echo    frontend\.env already exists (skipped)
)

echo.
echo =====================================================
echo   Setup complete!
echo =====================================================
echo.
echo NEXT STEPS:
echo.
echo 1. Edit backend\.env  ^(set DB_PASSWORD^)
echo 2. Edit frontend\.env ^(set VITE_MAPBOX_TOKEN^)
echo.
echo 3. Create the database and enable PostGIS:
echo    psql -U postgres -c "CREATE DATABASE fleet_db;"
echo    psql -U postgres -d fleet_db -c "CREATE EXTENSION postgis;"
echo.
echo 4. Load schema + test data:
echo    psql -U postgres -d fleet_db -f fleet_complete.sql
echo.
echo 5. Start the app:
echo    npm run dev
echo.
echo    Then open: http://localhost:5173
echo    Login:     admin@cloudnext.com / admin123
echo.
pause
exit /b 0

:error
echo.
echo [ERROR] Setup failed. Check the output above.
pause
exit /b 1
