const { query } = require('../db');

const vehicleStates = new Map();

function lerp(a, b, t) { return a + (b - a) * t; }
function randRange(min, max) { return min + Math.random() * (max - min); }
function degToRad(d) { return d * Math.PI / 180; }

// ── Regional Route Definitions ────────────────────────────────────────────────
const ROUTES = {

  // Lahore (default / legacy data)
  lahore: [
    { name: 'MM Alam Rd',    waypoints: [[74.358,31.517],[74.370,31.515],[74.382,31.512],[74.370,31.517],[74.358,31.517]] },
    { name: 'Canal Bank Rd', waypoints: [[74.320,31.490],[74.340,31.490],[74.360,31.490],[74.340,31.492],[74.320,31.490]] },
    { name: 'Ferozpur Rd',   waypoints: [[74.320,31.530],[74.340,31.520],[74.360,31.510],[74.340,31.520],[74.320,31.530]] },
    { name: 'GT Road',       waypoints: [[74.380,31.550],[74.400,31.548],[74.420,31.545],[74.400,31.549],[74.380,31.550]] },
    { name: 'Bedian Rd',     waypoints: [[74.410,31.460],[74.420,31.480],[74.430,31.500],[74.420,31.480],[74.410,31.460]] },
    { name: 'Raiwind Rd',    waypoints: [[74.310,31.470],[74.320,31.490],[74.330,31.510],[74.320,31.490],[74.310,31.470]] },
  ],

  // Riyadh — Saudi Arabia (Naqel Express)
  riyadh: [
    { name: 'King Fahd Rd',        waypoints: [[46.6730,24.7100],[46.7130,24.6960],[46.7530,24.6820],[46.7130,24.6960],[46.6730,24.7100]] },
    { name: 'Northern Ring Rd',    waypoints: [[46.6500,24.7600],[46.7000,24.7700],[46.7500,24.7800],[46.7000,24.7700],[46.6500,24.7600]] },
    { name: 'Olaya St',            waypoints: [[46.6820,24.6930],[46.6880,24.7080],[46.6940,24.7230],[46.6880,24.7080],[46.6820,24.6930]] },
    { name: 'Mecca Rd Expressway', waypoints: [[46.6100,24.6700],[46.6600,24.6750],[46.7100,24.6800],[46.6600,24.6750],[46.6100,24.6700]] },
    { name: 'Eastern Ring Rd',     waypoints: [[46.8200,24.6500],[46.8500,24.7000],[46.8800,24.7500],[46.8500,24.7000],[46.8200,24.6500]] },
    { name: 'Airport Rd',          waypoints: [[46.6983,24.8100],[46.6983,24.8600],[46.6983,24.9100],[46.6983,24.8600],[46.6983,24.8100]] },
  ],

  // Dubai — UAE (ENOC Fleet)
  dubai: [
    { name: 'Sheikh Zayed Rd',     waypoints: [[55.1400,25.0900],[55.1800,25.1200],[55.2200,25.1600],[55.1800,25.1200],[55.1400,25.0900]] },
    { name: 'Al Khail Rd',         waypoints: [[55.1800,25.0600],[55.2200,25.1000],[55.2600,25.1400],[55.2200,25.1000],[55.1800,25.0600]] },
    { name: 'Jebel Ali Corridor',  waypoints: [[55.0000,24.9800],[55.0500,24.9900],[55.1000,25.0000],[55.0500,24.9900],[55.0000,24.9800]] },
    { name: 'Dubai Creek Rd',      waypoints: [[55.2800,25.2300],[55.3100,25.2400],[55.3400,25.2500],[55.3100,25.2400],[55.2800,25.2300]] },
    { name: 'Emirates Rd (E611)',   waypoints: [[55.3000,25.0500],[55.3500,25.1200],[55.4000,25.1900],[55.3500,25.1200],[55.3000,25.0500]] },
    { name: 'Al Qudra Rd',         waypoints: [[55.1500,25.0000],[55.2000,24.9800],[55.2500,24.9600],[55.2000,24.9800],[55.1500,25.0000]] },
  ],

  // Doha — Qatar (Q-Logistics)
  doha: [
    { name: 'Al Shamal Rd',        waypoints: [[51.5200,25.2900],[51.5200,25.3500],[51.5200,25.4100],[51.5200,25.3500],[51.5200,25.2900]] },
    { name: 'Salwa Rd',            waypoints: [[51.5100,25.2800],[51.4700,25.2500],[51.4300,25.2200],[51.4700,25.2500],[51.5100,25.2800]] },
    { name: 'Corniche Rd',         waypoints: [[51.5000,25.2900],[51.5200,25.3100],[51.5400,25.3300],[51.5200,25.3100],[51.5000,25.2900]] },
    { name: 'Hamad Port Access',   waypoints: [[51.5300,25.1400],[51.5400,25.1700],[51.5500,25.2000],[51.5400,25.1700],[51.5300,25.1400]] },
    { name: 'Airport Expressway',  waypoints: [[51.5500,25.2500],[51.5700,25.2600],[51.5900,25.2700],[51.5700,25.2600],[51.5500,25.2500]] },
    { name: 'Industrial Area Loop', waypoints: [[51.4400,25.2300],[51.4600,25.2400],[51.4800,25.2500],[51.4600,25.2400],[51.4400,25.2300]] },
  ],

  // Muscat — Oman (Asyad Group)
  muscat: [
    { name: 'Sultan Qaboos Hwy',   waypoints: [[58.4800,23.5800],[58.5300,23.5900],[58.5800,23.6000],[58.5300,23.5900],[58.4800,23.5800]] },
    { name: 'Al Batinah Coastal',  waypoints: [[58.3000,23.6500],[58.4000,23.6400],[58.5000,23.6300],[58.4000,23.6400],[58.3000,23.6500]] },
    { name: 'Ruwi / Muttrah Rd',   waypoints: [[58.5700,23.6100],[58.5900,23.6200],[58.6100,23.6300],[58.5900,23.6200],[58.5700,23.6100]] },
    { name: 'Airport Connector',   waypoints: [[58.2500,23.5700],[58.2700,23.5800],[58.2900,23.5900],[58.2700,23.5800],[58.2500,23.5700]] },
    { name: 'Rusayl Industrial',   waypoints: [[58.1500,23.5500],[58.1700,23.5600],[58.1900,23.5700],[58.1700,23.5600],[58.1500,23.5500]] },
    { name: 'Muscat Expressway',   waypoints: [[58.5000,23.5600],[58.5500,23.5800],[58.6000,23.6000],[58.5500,23.5800],[58.5000,23.5600]] },
  ],

  // Kuwait City — Kuwait (Agility Logistics)
  kuwait: [
    { name: 'Gulf Rd',             waypoints: [[47.9500,29.3500],[47.9700,29.3700],[47.9900,29.3900],[47.9700,29.3700],[47.9500,29.3500]] },
    { name: 'Fahaheel Expressway', waypoints: [[47.9800,29.3200],[48.0300,29.2800],[48.0800,29.2400],[48.0300,29.2800],[47.9800,29.3200]] },
    { name: 'Airport Rd',          waypoints: [[47.9500,29.2800],[47.9600,29.2600],[47.9700,29.2400],[47.9600,29.2600],[47.9500,29.2800]] },
    { name: 'Shuwaikh Port Loop',  waypoints: [[47.9200,29.3600],[47.9400,29.3700],[47.9600,29.3800],[47.9400,29.3700],[47.9200,29.3600]] },
    { name: 'Ring Road (5th)',      waypoints: [[47.9000,29.3300],[47.9500,29.3100],[48.0000,29.2900],[47.9500,29.3100],[47.9000,29.3300]] },
    { name: 'Jahra Rd',            waypoints: [[47.8000,29.3500],[47.8500,29.3400],[47.9000,29.3300],[47.8500,29.3400],[47.8000,29.3500]] },
  ],

  // Manama — Bahrain (BLZ)
  bahrain: [
    { name: 'King Fahd Causeway',  waypoints: [[50.4800,26.1900],[50.5200,26.2000],[50.5600,26.2100],[50.5200,26.2000],[50.4800,26.1900]] },
    { name: 'Sheikh Khalifa Hwy',  waypoints: [[50.5500,26.2000],[50.5700,26.2200],[50.5900,26.2400],[50.5700,26.2200],[50.5500,26.2000]] },
    { name: 'Port Access Rd',      waypoints: [[50.6000,26.2000],[50.6200,26.2100],[50.6400,26.2200],[50.6200,26.2100],[50.6000,26.2000]] },
    { name: 'Hidd Industrial Loop', waypoints: [[50.6300,26.2100],[50.6500,26.2200],[50.6700,26.2300],[50.6500,26.2200],[50.6300,26.2100]] },
    { name: 'BLZ Perimeter Rd',    waypoints: [[50.6100,26.2200],[50.6200,26.2350],[50.6300,26.2500],[50.6200,26.2350],[50.6100,26.2200]] },
    { name: 'Al Areen / Riffa Rd', waypoints: [[50.5400,26.1400],[50.5600,26.1600],[50.5800,26.1800],[50.5600,26.1600],[50.5400,26.1400]] },
  ],
};

// Detect region from GPS coordinates
function getRoutes(lng, lat) {
  if (lng >= 45.5 && lng <= 50.0 && lat >= 23.5 && lat <= 26.5) return ROUTES.riyadh;
  if (lng >= 54.5 && lng <= 56.5 && lat >= 24.3 && lat <= 26.0) return ROUTES.dubai;
  if (lng >= 51.2 && lng <= 52.0 && lat >= 24.8 && lat <= 26.0) return ROUTES.doha;
  if (lng >= 57.5 && lng <= 59.5 && lat >= 22.5 && lat <= 24.5) return ROUTES.muscat;
  if (lng >= 47.5 && lng <= 48.5 && lat >= 28.8 && lat <= 30.0) return ROUTES.kuwait;
  if (lng >= 50.3 && lng <= 50.9 && lat >= 25.9 && lat <= 26.5) return ROUTES.bahrain;
  return ROUTES.lahore;
}

// ── Simulator Core ────────────────────────────────────────────────────────────
async function initSimulator() {
  const result = await query(`
    SELECT id, registration, current_speed, current_heading,
           ST_X(current_location) as lng, ST_Y(current_location) as lat,
           current_fuel, current_odometer, max_speed, status
    FROM vehicles
    WHERE status IN ('active', 'idle')
  `);

  for (const v of result.rows) {
    const lng = parseFloat(v.lng) || 74.3587;
    const lat = parseFloat(v.lat) || 31.5204;
    const routes = getRoutes(lng, lat);
    const route  = routes[Math.floor(Math.random() * routes.length)];

    vehicleStates.set(v.id, {
      id: v.id,
      registration: v.registration,
      lng,
      lat,
      speed:       parseFloat(v.current_speed)   || 0,
      heading:     parseFloat(v.current_heading)  || Math.random() * 360,
      fuel:        parseFloat(v.current_fuel)     || 80,
      odometer:    parseFloat(v.current_odometer) || 0,
      maxSpeed:    parseFloat(v.max_speed)        || 100,
      status:      v.status,
      route,
      routes,      // keep region routes for re-assignment
      waypointIdx: 0,
      targetSpeed: v.status === 'active' ? randRange(30, 80) : 0,
      idleTimer:   0,
    });
  }
  console.log(`✓ Simulator initialised with ${vehicleStates.size} vehicles`);
}

function moveVehicle(state, dt) {
  // Smoothly accelerate / decelerate toward target
  const speedDiff = state.targetSpeed - state.speed;
  state.speed += Math.sign(speedDiff) * Math.min(Math.abs(speedDiff), 5 * dt);
  state.speed = Math.max(0, Math.min(state.speed, state.maxSpeed));

  // Occasionally change target speed
  if (Math.random() < 0.05 && state.status === 'active') {
    state.targetSpeed = randRange(20, Math.min(state.maxSpeed, 100));
  }

  // Occasionally go idle
  if (Math.random() < 0.02 && state.status === 'active') {
    state.targetSpeed = 0;
    state.status = 'idle';
    state.idleTimer = randRange(30, 120);
  }

  // Resume from idle
  if (state.status === 'idle') {
    state.idleTimer -= dt;
    if (state.idleTimer <= 0) {
      state.status = 'active';
      state.targetSpeed = randRange(30, 80);
      // Pick a fresh route
      state.route = state.routes[Math.floor(Math.random() * state.routes.length)];
      state.waypointIdx = 0;
    }
  }

  // Move toward next waypoint
  if (state.speed > 1) {
    const wp = state.route.waypoints[state.waypointIdx];
    const dLng = wp[0] - state.lng;
    const dLat = wp[1] - state.lat;
    const targetHeading = (Math.atan2(dLng, dLat) * 180 / Math.PI + 360) % 360;

    const headingDiff = ((targetHeading - state.heading + 540) % 360) - 180;
    state.heading += Math.sign(headingDiff) * Math.min(Math.abs(headingDiff), 10 * dt);
    state.heading = (state.heading + 360) % 360;

    const distM   = (state.speed * dt) / 3.6;
    const distDeg = distM / 111320;
    state.lng += Math.sin(degToRad(state.heading)) * distDeg;
    state.lat += Math.cos(degToRad(state.heading)) * distDeg;

    // Realistic GPS jitter
    state.lng += (Math.random() - 0.5) * 0.00002;
    state.lat += (Math.random() - 0.5) * 0.00002;

    const dist = Math.sqrt(dLng * dLng + dLat * dLat);
    if (dist < 0.002) {
      state.waypointIdx = (state.waypointIdx + 1) % state.route.waypoints.length;
    }

    state.odometer += distM / 1000;
  }

  // Fuel consumption
  if (state.speed > 0) {
    const consumption = (state.speed / 100) * 0.00028 * dt;
    state.fuel = Math.max(5, state.fuel - consumption);
  }

  return state;
}

async function tick(broadcastFn) {
  const dt = parseInt(process.env.SIMULATION_INTERVAL_MS || '3000') / 1000;
  const updates = [];

  for (const [id, state] of vehicleStates) {
    moveVehicle(state, dt);

    await query(`
      UPDATE vehicles SET
        current_location = ST_SetSRID(ST_MakePoint($1, $2), 4326),
        current_speed    = $3,
        current_heading  = $4,
        current_fuel     = $5,
        current_odometer = $6,
        engine_on        = $7,
        status           = $8,
        last_seen        = NOW(),
        updated_at       = NOW()
      WHERE id = $9
    `, [
      state.lng, state.lat,
      Math.round(state.speed   * 10) / 10,
      Math.round(state.heading),
      Math.round(state.fuel    * 10) / 10,
      Math.round(state.odometer),
      state.speed > 0,
      state.status,
      id,
    ]);

    await query(`
      INSERT INTO telemetry (vehicle_id, location, speed, heading, fuel_level, odometer, engine_on)
      VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326), $4, $5, $6, $7, $8)
    `, [id, state.lng, state.lat, state.speed, state.heading, state.fuel, state.odometer, state.speed > 0]);

    await generateAlerts(state);

    updates.push({
      id,
      registration: state.registration,
      lng:    state.lng,
      lat:    state.lat,
      speed:  Math.round(state.speed   * 10) / 10,
      heading: Math.round(state.heading),
      fuel:   Math.round(state.fuel    * 10) / 10,
      status: state.status,
      engine_on: state.speed > 0,
    });
  }

  if (broadcastFn && updates.length > 0) {
    broadcastFn({ type: 'telemetry_batch', vehicles: updates, timestamp: new Date().toISOString() });
  }
}

async function generateAlerts(state) {
  // Speeding
  if (state.speed > state.maxSpeed * 0.95 && Math.random() < 0.1) {
    await query(`
      INSERT INTO alerts (vehicle_id, type, severity, title, message, location, speed)
      VALUES ($1,'speeding','critical','Speed Limit Exceeded',$2,
              ST_SetSRID(ST_MakePoint($3,$4),4326),$5)
    `, [state.id,
        `${state.registration} travelling at ${Math.round(state.speed)} km/h (limit: ${Math.round(state.maxSpeed)} km/h)`,
        state.lng, state.lat, Math.round(state.speed)]);
  }

  // Low fuel
  if (state.fuel < 15 && Math.random() < 0.05) {
    await query(`
      INSERT INTO alerts (vehicle_id, type, severity, title, message, location)
      VALUES ($1,'low_fuel','warning','Low Fuel Warning',$2,ST_SetSRID(ST_MakePoint($3,$4),4326))
    `, [state.id, `${state.registration} fuel at ${Math.round(state.fuel)}%`, state.lng, state.lat]);
  }

  // Harsh braking
  if (state.speed > 50 && Math.random() < 0.02) {
    await query(`
      INSERT INTO alerts (vehicle_id, type, severity, title, message, location)
      VALUES ($1,'harsh_braking','warning','Harsh Braking Detected',$2,ST_SetSRID(ST_MakePoint($3,$4),4326))
    `, [state.id, `Sudden deceleration event on ${state.registration}`, state.lng, state.lat]);
  }

  // Geofence exit detection
  try {
    const gfResult = await query(`
      SELECT g.id, g.name
      FROM geofences g
      WHERE g.is_active = true
        AND NOT ST_Within(ST_SetSRID(ST_MakePoint($1,$2),4326), g.boundary)
        AND EXISTS (
          SELECT 1 FROM telemetry t
          WHERE t.vehicle_id = $3
            AND t.recorded_at > NOW() - INTERVAL '10 seconds'
            AND ST_Within(t.location, g.boundary)
          ORDER BY t.recorded_at DESC LIMIT 1
        )
      LIMIT 1
    `, [state.lng, state.lat, state.id]);

    if (gfResult.rows.length > 0) {
      const gf = gfResult.rows[0];
      await query(`
        INSERT INTO alerts (vehicle_id, geofence_id, type, severity, title, message, location)
        VALUES ($1,$2,'geofence_exit','info','Geofence Exit',$3,ST_SetSRID(ST_MakePoint($4,$5),4326))
      `, [state.id, gf.id, `${state.registration} exited geofence: ${gf.name}`, state.lng, state.lat]);
    }
  } catch (_) { /* silent */ }
}

module.exports = { initSimulator, tick, vehicleStates };
