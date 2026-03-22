const { query } = require('../db');

// Simple route simulation: vehicles move along random paths
const vehicleStates = new Map();

function lerp(a, b, t) { return a + (b - a) * t; }
function randRange(min, max) { return min + Math.random() * (max - min); }
function degToRad(d) { return d * Math.PI / 180; }

// Lahore road segments for realistic movement
const LAHORE_ROUTES = [
  { name: 'MM Alam Rd',     waypoints: [[74.358,31.517],[74.370,31.515],[74.382,31.512]] },
  { name: 'Canal Bank Rd',  waypoints: [[74.320,31.490],[74.340,31.490],[74.360,31.490]] },
  { name: 'Ferozpur Rd',    waypoints: [[74.320,31.530],[74.340,31.520],[74.360,31.510]] },
  { name: 'GT Road',        waypoints: [[74.380,31.550],[74.400,31.548],[74.420,31.545]] },
  { name: 'Bedian Rd',      waypoints: [[74.410,31.460],[74.420,31.480],[74.430,31.500]] },
  { name: 'Raiwind Rd',     waypoints: [[74.310,31.470],[74.320,31.490],[74.330,31.510]] },
];

async function initSimulator() {
  // Load active vehicles
  const result = await query(`
    SELECT id, registration, current_speed, current_heading,
           ST_X(current_location) as lng, ST_Y(current_location) as lat,
           current_fuel, current_odometer, max_speed, status
    FROM vehicles
    WHERE status IN ('active', 'idle')
  `);

  for (const v of result.rows) {
    const route = LAHORE_ROUTES[Math.floor(Math.random() * LAHORE_ROUTES.length)];
    vehicleStates.set(v.id, {
      id: v.id,
      registration: v.registration,
      lng: parseFloat(v.lng) || 74.3587,
      lat: parseFloat(v.lat) || 31.5204,
      speed: parseFloat(v.current_speed) || 0,
      heading: parseFloat(v.current_heading) || Math.random() * 360,
      fuel: parseFloat(v.current_fuel) || 80,
      odometer: parseFloat(v.current_odometer) || 0,
      maxSpeed: parseFloat(v.max_speed) || 100,
      status: v.status,
      route,
      waypointIdx: 0,
      targetSpeed: v.status === 'active' ? randRange(30, 80) : 0,
      idleTimer: 0,
    });
  }
  console.log(`✓ Simulator initialised with ${vehicleStates.size} vehicles`);
}

function moveVehicle(state, dt) {
  // Smoothly change speed toward target
  const speedDiff = state.targetSpeed - state.speed;
  state.speed += Math.sign(speedDiff) * Math.min(Math.abs(speedDiff), 5 * dt);
  state.speed = Math.max(0, Math.min(state.speed, state.maxSpeed));

  // Occasionally change target speed
  if (Math.random() < 0.05) {
    if (state.status === 'active') {
      state.targetSpeed = randRange(20, Math.min(state.maxSpeed, 100));
    }
  }

  // Occasionally go idle
  if (Math.random() < 0.02 && state.status === 'active') {
    state.targetSpeed = 0;
    state.status = 'idle';
    state.idleTimer = randRange(30, 120); // seconds
  }

  // Resume from idle
  if (state.status === 'idle') {
    state.idleTimer -= dt;
    if (state.idleTimer <= 0) {
      state.status = 'active';
      state.targetSpeed = randRange(30, 80);
    }
  }

  // Move toward next waypoint
  if (state.speed > 1) {
    const wp = state.route.waypoints[state.waypointIdx];
    const targetLng = wp[0];
    const targetLat = wp[1];

    // Calculate heading to waypoint
    const dLng = targetLng - state.lng;
    const dLat = targetLat - state.lat;
    const targetHeading = (Math.atan2(dLng, dLat) * 180 / Math.PI + 360) % 360;

    // Smooth heading change
    const headingDiff = ((targetHeading - state.heading + 540) % 360) - 180;
    state.heading += Math.sign(headingDiff) * Math.min(Math.abs(headingDiff), 10 * dt);
    state.heading = (state.heading + 360) % 360;

    // Move in heading direction
    const distM = (state.speed * dt) / 3.6; // km/h -> m/s * dt
    const distDeg = distM / 111320; // approx metres per degree
    state.lng += Math.sin(degToRad(state.heading)) * distDeg;
    state.lat += Math.cos(degToRad(state.heading)) * distDeg;

    // Add tiny realistic jitter
    state.lng += (Math.random() - 0.5) * 0.00002;
    state.lat += (Math.random() - 0.5) * 0.00002;

    // Check if reached waypoint
    const dist = Math.sqrt(dLng*dLng + dLat*dLat);
    if (dist < 0.002) {
      state.waypointIdx = (state.waypointIdx + 1) % state.route.waypoints.length;
    }

    // Odometer
    state.odometer += distM / 1000;
  }

  // Fuel consumption
  if (state.speed > 0) {
    const consumption = (state.speed / 100) * 0.00028 * dt; // litres
    state.fuel = Math.max(5, state.fuel - consumption);
  }

  return state;
}

async function tick(broadcastFn) {
  const dt = parseInt(process.env.SIMULATION_INTERVAL_MS || '3000') / 1000;
  const updates = [];

  for (const [id, state] of vehicleStates) {
    moveVehicle(state, dt);

    // Update DB
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
      Math.round(state.speed * 10) / 10,
      Math.round(state.heading),
      Math.round(state.fuel * 10) / 10,
      Math.round(state.odometer),
      state.speed > 0,
      state.status,
      id
    ]);

    // Insert telemetry point
    await query(`
      INSERT INTO telemetry (vehicle_id, location, speed, heading, fuel_level, odometer, engine_on)
      VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326), $4, $5, $6, $7, $8)
    `, [id, state.lng, state.lat, state.speed, state.heading, state.fuel, state.odometer, state.speed > 0]);

    // Randomly generate alerts
    await generateAlerts(state);

    updates.push({
      id,
      registration: state.registration,
      lng: state.lng,
      lat: state.lat,
      speed: Math.round(state.speed * 10) / 10,
      heading: Math.round(state.heading),
      fuel: Math.round(state.fuel * 10) / 10,
      status: state.status,
      engine_on: state.speed > 0,
    });
  }

  // Broadcast to WebSocket clients
  if (broadcastFn && updates.length > 0) {
    broadcastFn({ type: 'telemetry_batch', vehicles: updates, timestamp: new Date().toISOString() });
  }
}

async function generateAlerts(state) {
  // Speeding alert
  if (state.speed > state.maxSpeed * 0.95 && Math.random() < 0.1) {
    await query(`
      INSERT INTO alerts (vehicle_id, type, severity, title, message, location, speed)
      VALUES (
        $1, 'speeding', 'critical',
        'Speed Limit Exceeded',
        $2,
        ST_SetSRID(ST_MakePoint($3, $4), 4326),
        $5
      )
    `, [
      state.id,
      `${state.registration} travelling at ${Math.round(state.speed)} km/h (limit: ${Math.round(state.maxSpeed)} km/h)`,
      state.lng, state.lat,
      Math.round(state.speed)
    ]);
  }

  // Low fuel alert
  if (state.fuel < 15 && Math.random() < 0.05) {
    await query(`
      INSERT INTO alerts (vehicle_id, type, severity, title, message, location)
      VALUES ($1, 'low_fuel', 'warning', 'Low Fuel Warning',
        $2, ST_SetSRID(ST_MakePoint($3, $4), 4326))
    `, [state.id, `${state.registration} fuel at ${Math.round(state.fuel)}%`, state.lng, state.lat]);
  }

  // Harsh braking simulation
  if (state.speed > 50 && Math.random() < 0.02) {
    await query(`
      INSERT INTO alerts (vehicle_id, type, severity, title, message, location)
      VALUES ($1, 'harsh_braking', 'warning', 'Harsh Braking Detected',
        $2, ST_SetSRID(ST_MakePoint($3, $4), 4326))
    `, [state.id, `Sudden deceleration event on ${state.registration}`, state.lng, state.lat]);
  }

  // Check geofence violations
  try {
    const gfResult = await query(`
      SELECT g.id, g.name, g.alert_on_exit
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
        VALUES ($1, $2, 'geofence_exit', 'info', 'Geofence Exit', $3, ST_SetSRID(ST_MakePoint($4,$5),4326))
      `, [state.id, gf.id, `${state.registration} exited geofence: ${gf.name}`, state.lng, state.lat]);
    }
  } catch (_) { /* silent */ }
}

module.exports = { initSimulator, tick, vehicleStates };
