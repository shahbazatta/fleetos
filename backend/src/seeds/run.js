require('dotenv').config();
const { pool } = require('../db');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

// Lahore area coordinates
const LAHORE_CENTER = [74.3587, 31.5204];

function randNear(center, spread = 0.05) {
  return [
    center[0] + (Math.random() - 0.5) * spread,
    center[1] + (Math.random() - 0.5) * spread
  ];
}

const DEPOTS = [
  { name: 'Raiwind Road Depot',   address: 'Raiwind Road, Lahore',    coords: [74.3200, 31.4800] },
  { name: 'DHA Phase 5 Hub',      address: 'DHA Phase 5, Lahore',     coords: [74.4100, 31.4700] },
  { name: 'Gulberg Central Base', address: 'Gulberg III, Lahore',     coords: [74.3450, 31.5100] },
];

const VEHICLES_DATA = [
  { reg: 'LHR-001', make: 'Isuzu',  model: 'NPR',      year: 2021, type: 'truck',   color: 'White',  max_speed: 100, fuel_cap: 80 },
  { reg: 'LHR-002', make: 'Hino',   model: '300',      year: 2022, type: 'truck',   color: 'Blue',   max_speed: 110, fuel_cap: 90 },
  { reg: 'LHR-003', make: 'Fuso',   model: 'Canter',   year: 2020, type: 'van',     color: 'Silver', max_speed: 105, fuel_cap: 70 },
  { reg: 'LHR-004', make: 'Tata',   model: 'LPT',      year: 2019, type: 'heavy',   color: 'Red',    max_speed: 90,  fuel_cap: 120 },
  { reg: 'LHR-005', make: 'Toyota', model: 'Hiace',    year: 2023, type: 'van',     color: 'White',  max_speed: 120, fuel_cap: 65 },
  { reg: 'LHR-006', make: 'Suzuki', model: 'Carry',    year: 2022, type: 'van',     color: 'Yellow', max_speed: 100, fuel_cap: 35 },
  { reg: 'LHR-007', make: 'Isuzu',  model: 'ELF',      year: 2021, type: 'truck',   color: 'Green',  max_speed: 105, fuel_cap: 85 },
  { reg: 'LHR-008', make: 'Honda',  model: 'CD-70',    year: 2023, type: 'motorcycle', color: 'Black', max_speed: 80, fuel_cap: 12 },
  { reg: 'LHR-009', make: 'Toyota', model: 'Corolla',  year: 2022, type: 'car',     color: 'White',  max_speed: 160, fuel_cap: 45 },
  { reg: 'LHR-010', make: 'Hino',   model: '500',      year: 2020, type: 'heavy',   color: 'Orange', max_speed: 85,  fuel_cap: 150 },
  { reg: 'LHR-011', make: 'MAN',    model: 'TGS',      year: 2021, type: 'heavy',   color: 'Gray',   max_speed: 90,  fuel_cap: 200 },
  { reg: 'LHR-012', make: 'Yutong', model: 'ZK6107',   year: 2022, type: 'bus',     color: 'Blue',   max_speed: 100, fuel_cap: 180 },
];

const DRIVERS_DATA = [
  { emp: 'EMP-001', name: 'Ahmed Raza',      phone: '+92-300-1234567', license: 'LHR-DL-001', score: 97 },
  { emp: 'EMP-002', name: 'Sajid Mehmood',   phone: '+92-301-2345678', license: 'LHR-DL-002', score: 93 },
  { emp: 'EMP-003', name: 'Usman Tariq',     phone: '+92-302-3456789', license: 'LHR-DL-003', score: 81 },
  { emp: 'EMP-004', name: 'Bilal Chaudhry',  phone: '+92-303-4567890', license: 'LHR-DL-004', score: 76 },
  { emp: 'EMP-005', name: 'Imran Gul',       phone: '+92-304-5678901', license: 'LHR-DL-005', score: 52 },
  { emp: 'EMP-006', name: 'Faisal Khan',     phone: '+92-305-6789012', license: 'LHR-DL-006', score: 88 },
  { emp: 'EMP-007', name: 'Zubair Hassan',   phone: '+92-306-7890123', license: 'LHR-DL-007', score: 91 },
  { emp: 'EMP-008', name: 'Wasim Akhtar',    phone: '+92-307-8901234', license: 'LHR-DL-008', score: 85 },
  { emp: 'EMP-009', name: 'Rizwan Malik',    phone: '+92-308-9012345', license: 'LHR-DL-009', score: 79 },
  { emp: 'EMP-010', name: 'Tariq Javeed',    phone: '+92-309-0123456', license: 'LHR-DL-010', score: 95 },
  { emp: 'EMP-011', name: 'Khalid Mehmood',  phone: '+92-310-1234567', license: 'LHR-DL-011', score: 68 },
  { emp: 'EMP-012', name: 'Nadeem Iqbal',    phone: '+92-311-2345678', license: 'LHR-DL-012', score: 87 },
];

const GEOFENCES_DATA = [
  {
    name: 'DHA Delivery Zone',
    description: 'Defence Housing Authority delivery area',
    color: '#00d4e8',
    coords: [[74.38,31.45],[74.45,31.45],[74.45,31.50],[74.38,31.50],[74.38,31.45]]
  },
  {
    name: 'Gulberg Commercial',
    description: 'Gulberg commercial and shopping district',
    color: '#a3e635',
    coords: [[74.33,31.50],[74.37,31.50],[74.37,31.54],[74.33,31.54],[74.33,31.50]]
  },
  {
    name: 'Lahore Airport Restricted',
    description: 'No commercial vehicles zone near airport',
    color: '#ef4444',
    coords: [[74.38,31.51],[74.42,31.51],[74.42,31.55],[74.38,31.55],[74.38,31.51]]
  },
  {
    name: 'Johar Town Zone',
    description: 'Johar Town residential delivery zone',
    color: '#f59e0b',
    coords: [[74.27,31.45],[74.33,31.45],[74.33,31.50],[74.27,31.50],[74.27,31.45]]
  },
];

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('Seeding database...');

    // Admin user
    const hash = await bcrypt.hash('admin123', 10);
    await client.query(`
      INSERT INTO users (email, password_hash, full_name, role) VALUES
      ($1, $2, 'Admin User', 'admin'),
      ('operator@cloudnext.com', $2, 'Fleet Operator', 'operator')
      ON CONFLICT (email) DO NOTHING
    `, ['admin@cloudnext.com', hash]);
    console.log('  ✓ Users');

    // Depots
    const depotIds = [];
    for (const d of DEPOTS) {
      const r = await client.query(`
        INSERT INTO depots (name, address, location)
        VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326))
        ON CONFLICT DO NOTHING
        RETURNING id
      `, [d.name, d.address, d.coords[0], d.coords[1]]);
      if (r.rows[0]) depotIds.push(r.rows[0].id);
    }
    // Re-fetch if already existed
    if (depotIds.length === 0) {
      const r = await client.query('SELECT id FROM depots ORDER BY created_at');
      r.rows.forEach(row => depotIds.push(row.id));
    }
    console.log('  ✓ Depots');

    // Drivers
    const driverIds = [];
    for (let i = 0; i < DRIVERS_DATA.length; i++) {
      const d = DRIVERS_DATA[i];
      const depotId = depotIds[i % depotIds.length];
      const r = await client.query(`
        INSERT INTO drivers (employee_id, full_name, phone, license_number, license_expiry, safety_score, depot_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (license_number) DO UPDATE SET safety_score = EXCLUDED.safety_score
        RETURNING id
      `, [d.emp, d.name, d.phone, d.license, '2027-12-31', d.score, depotId]);
      driverIds.push(r.rows[0].id);
    }
    console.log('  ✓ Drivers');

    // Vehicles with simulated starting positions
    const vehicleIds = [];
    const statuses = ['active','active','active','active','idle','idle','active','active','idle','active','offline','active'];
    for (let i = 0; i < VEHICLES_DATA.length; i++) {
      const v = VEHICLES_DATA[i];
      const pos = randNear(LAHORE_CENTER);
      const status = statuses[i] || 'active';
      const fuel = 30 + Math.random() * 70;
      const odometer = 10000 + Math.random() * 90000;
      const depotId = depotIds[i % depotIds.length];
      const driverId = status !== 'offline' ? driverIds[i] : null;

      const r = await client.query(`
        INSERT INTO vehicles (
          registration, make, model, year, type, color,
          status, current_location, current_speed, current_heading,
          current_fuel, current_odometer, engine_on,
          fuel_capacity, max_speed, health_score,
          assigned_driver_id, depot_id, last_seen
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, ST_SetSRID(ST_MakePoint($8, $9), 4326), $10, $11,
          $12, $13, $14,
          $15, $16, $17,
          $18, $19, NOW()
        )
        ON CONFLICT (registration) DO UPDATE SET
          current_location = EXCLUDED.current_location,
          status = EXCLUDED.status,
          last_seen = NOW()
        RETURNING id
      `, [
        v.reg, v.make, v.model, v.year, v.type, v.color,
        status, pos[0], pos[1],
        status === 'active' ? Math.floor(Math.random() * 90) : 0,
        Math.floor(Math.random() * 360),
        Math.round(fuel * 10) / 10,
        Math.round(odometer),
        status === 'active',
        v.fuel_cap, v.max_speed,
        70 + Math.random() * 30,
        driverId, depotId
      ]);
      vehicleIds.push(r.rows[0].id);
    }
    console.log('  ✓ Vehicles');

    // Geofences
    for (const g of GEOFENCES_DATA) {
      const ring = g.coords.map(c => `${c[0]} ${c[1]}`).join(',');
      await client.query(`
        INSERT INTO geofences (name, description, color, boundary)
        VALUES ($1, $2, $3, ST_SetSRID(ST_GeomFromText($4), 4326))
        ON CONFLICT DO NOTHING
      `, [g.name, g.description, g.color, `POLYGON((${ring}))`]);
    }
    console.log('  ✓ Geofences');

    // Sample alerts
    const alertTypes = ['speeding', 'idle_timeout', 'low_fuel', 'harsh_braking', 'geofence_exit'];
    const alertSeverities = ['critical', 'warning', 'warning', 'warning', 'info'];
    for (let i = 0; i < 20; i++) {
      const vIdx = Math.floor(Math.random() * vehicleIds.length);
      const aType = alertTypes[i % alertTypes.length];
      const aSev = alertSeverities[i % alertSeverities.length];
      const pos = randNear(LAHORE_CENTER);
      const minsAgo = Math.floor(Math.random() * 120);
      await client.query(`
        INSERT INTO alerts (vehicle_id, type, severity, title, message, location, occurred_at)
        VALUES ($1, $2, $3, $4, $5, ST_SetSRID(ST_MakePoint($6, $7), 4326), NOW() - INTERVAL '${minsAgo} minutes')
      `, [
        vehicleIds[vIdx], aType, aSev,
        aType === 'speeding' ? 'Speed Limit Exceeded' :
        aType === 'idle_timeout' ? 'Extended Idle Detected' :
        aType === 'low_fuel' ? 'Low Fuel Warning' :
        aType === 'harsh_braking' ? 'Harsh Braking Event' : 'Geofence Exit',
        `Vehicle detected: ${aType.replace('_', ' ')} at ${new Date().toLocaleTimeString()}`,
        pos[0], pos[1]
      ]);
    }
    console.log('  ✓ Alerts');

    // Seed some telemetry history (last 30 minutes per active vehicle)
    for (let v = 0; v < Math.min(vehicleIds.length, 6); v++) {
      const basePos = randNear(LAHORE_CENTER, 0.03);
      for (let t = 30; t >= 0; t--) {
        const pos = [basePos[0] + (Math.random()-0.5)*0.001*t, basePos[1] + (Math.random()-0.5)*0.001*t];
        await client.query(`
          INSERT INTO telemetry (vehicle_id, recorded_at, location, speed, heading, fuel_level, odometer, engine_on)
          VALUES ($1, NOW() - INTERVAL '${t} minutes', ST_SetSRID(ST_MakePoint($2, $3), 4326), $4, $5, $6, $7, true)
        `, [vehicleIds[v], pos[0], pos[1], Math.floor(20 + Math.random()*80), Math.floor(Math.random()*360), 60+Math.random()*40, 50000+t*0.5]);
      }
    }
    console.log('  ✓ Telemetry history');

    // Driver scores
    for (let i = 0; i < driverIds.length; i++) {
      const base = DRIVERS_DATA[i].score;
      await client.query(`
        INSERT INTO driver_scores (driver_id, period_date, overall_score, speed_score, braking_score, cornering_score, fuel_score, distance_km)
        VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6, $7)
      `, [driverIds[i], base, base+Math.random()*5-2, base+Math.random()*5-2, base+Math.random()*5-2, base+Math.random()*5-2, 80+Math.random()*200]);
    }
    console.log('  ✓ Driver scores');

    await client.query('COMMIT');
    console.log('\n✓ Database seeded successfully!');
    console.log('  Login: admin@cloudnext.com / admin123');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed error:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
