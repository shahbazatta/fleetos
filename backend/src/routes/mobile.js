// mobile.js — API endpoints for Driver/Supervisor mobile app
const router = require('express').Router();
const { query } = require('../db');
const { auth, tenantScope } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

const tw = (tid, alias = '') => {
  const col = alias ? `${alias}.tenant_id` : 'tenant_id';
  return tid ? `${col} = '${tid}'` : '1=1';
};

// ── Auth check for mobile ──────────────────────────────────────────────────────
// GET /api/mobile/me — returns current user with driver/supervisor info
router.get('/me', auth, tenantScope, async (req, res) => {
  try {
    const result = await query(`
      SELECT u.id, u.email, u.full_name, u.role, u.tenant_id,
             d.id AS driver_id, d.employee_id, d.phone, d.safety_score,
             d.license_class, d.status AS driver_status,
             v.id AS vehicle_id, v.registration, v.make, v.model, v.qr_code,
             r.id AS route_id, r.name AS route_name, r.color AS route_color,
             ST_AsGeoJSON(r.path)::json AS route_path
      FROM users u
      LEFT JOIN drivers d ON d.user_id = u.id
      LEFT JOIN vehicles v ON v.assigned_driver_id = d.id
      LEFT JOIN routes r ON v.route_id = r.id
      WHERE u.id = $1
    `, [req.userId]);
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
    res.json({ user: result.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Driver: QR Scan to pair with bus ─────────────────────────────────────────
// POST /api/mobile/pair-bus — driver scans bus QR code
router.post('/pair-bus', auth, tenantScope, async (req, res) => {
  const { qr_code } = req.body;
  if (!qr_code) return res.status(400).json({ error: 'qr_code is required' });
  try {
    // Find vehicle by QR code
    const vResult = await query(`
      SELECT v.id, v.registration, v.make, v.model, v.status,
             r.id AS route_id, r.name AS route_name, ST_AsGeoJSON(r.path)::json AS route_path
      FROM vehicles v
      LEFT JOIN routes r ON v.route_id = r.id
      WHERE v.qr_code = $1 AND ${tw(req.tenantId, 'v')}
    `, [qr_code]);
    if (!vResult.rows.length) return res.status(404).json({ error: 'Bus not found for this QR code' });
    const vehicle = vResult.rows[0];

    // Find the driver linked to the current user
    const dResult = await query(`SELECT id, full_name, employee_id FROM drivers WHERE user_id = $1`, [req.userId]);
    if (!dResult.rows.length) return res.status(400).json({ error: 'No driver profile linked to this account' });
    const driver = dResult.rows[0];

    // Unassign driver from previous vehicle
    await query(`UPDATE vehicles SET assigned_driver_id = NULL WHERE assigned_driver_id = $1`, [driver.id]);
    // Unassign any driver currently on this vehicle
    await query(`UPDATE vehicles SET assigned_driver_id = NULL WHERE id = $1`, [vehicle.id]);
    // Assign driver to vehicle
    await query(`UPDATE vehicles SET assigned_driver_id = $1, updated_at = NOW() WHERE id = $2`, [driver.id, vehicle.id]);

    // Log the pairing event as an alert
    await query(`
      INSERT INTO alerts (tenant_id, vehicle_id, type, severity, message, occurred_at)
      VALUES ($1,$2,'offline','info',$3,NOW())
    `, [req.tenantId, vehicle.id, `Driver ${driver.full_name} (${driver.employee_id}) paired with bus ${vehicle.registration}`]).catch(() => {});

    res.json({
      success: true,
      message: `Paired with bus ${vehicle.registration}`,
      vehicle,
      driver
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Driver: GPS Tracking ──────────────────────────────────────────────────────
// POST /api/mobile/telemetry — driver app posts GPS updates every 30sec
router.post('/telemetry', auth, tenantScope, async (req, res) => {
  const { vehicle_id, lat, lng, speed, heading, fuel_level, engine_on } = req.body;
  if (!vehicle_id || lat == null || lng == null) return res.status(400).json({ error: 'vehicle_id, lat, lng are required' });
  try {
    // Verify vehicle belongs to tenant
    const vCheck = await query(`SELECT id FROM vehicles WHERE id = $1 AND ${tw(req.tenantId)}`, [vehicle_id]);
    if (!vCheck.rows.length) return res.status(404).json({ error: 'Vehicle not found' });

    // Update vehicle live location
    await query(`
      UPDATE vehicles SET
        current_location = ST_SetSRID(ST_MakePoint($1,$2),4326),
        current_speed = $3,
        current_heading = $4,
        current_fuel = $5,
        engine_on = $6,
        last_seen = NOW(),
        status = CASE WHEN $6 THEN 'active'::vehicle_status ELSE 'idle'::vehicle_status END,
        updated_at = NOW()
      WHERE id = $7
    `, [lng, lat, speed||0, heading||0, fuel_level||null, engine_on??true, vehicle_id]);

    // Insert telemetry record
    await query(`
      INSERT INTO telemetry (vehicle_id, recorded_at, location, speed, heading, fuel_level, engine_on)
      VALUES ($1, NOW(), ST_SetSRID(ST_MakePoint($2,$3),4326), $4, $5, $6, $7)
    `, [vehicle_id, lng, lat, speed||0, heading||0, fuel_level||null, engine_on??true]);

    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Supervisor: Generate dispatch approval QR ─────────────────────────────────
// POST /api/mobile/dispatch/generate — supervisor generates approval QR
router.post('/dispatch/generate', auth, tenantScope, async (req, res) => {
  const { vehicle_id, driver_id } = req.body;
  if (!vehicle_id || !driver_id) return res.status(400).json({ error: 'vehicle_id and driver_id are required' });
  try {
    const vCheck = await query(`SELECT id, registration FROM vehicles WHERE id = $1 AND ${tw(req.tenantId)}`, [vehicle_id]);
    if (!vCheck.rows.length) return res.status(404).json({ error: 'Vehicle not found' });
    const dCheck = await query(`SELECT id, full_name FROM drivers WHERE id = $1 AND ${tw(req.tenantId)}`, [driver_id]);
    if (!dCheck.rows.length) return res.status(404).json({ error: 'Driver not found' });

    const approvalId = uuidv4();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min expiry
    const qrPayload = `cloudnext://dispatch/${approvalId}`;

    // Store approval token in dispatch_approvals table
    await query(`
      INSERT INTO dispatch_approvals (id, tenant_id, vehicle_id, driver_id, supervisor_id, qr_payload, expires_at, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'pending')
    `, [approvalId, req.tenantId, vehicle_id, driver_id, req.userId, qrPayload, expiresAt]);

    res.json({
      approval_id: approvalId,
      qr_payload: qrPayload,
      vehicle: vCheck.rows[0],
      driver: dCheck.rows[0],
      expires_at: expiresAt,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Driver: Scan dispatch approval QR ────────────────────────────────────────
// POST /api/mobile/dispatch/approve — driver scans supervisor QR to start trip
router.post('/dispatch/approve', auth, tenantScope, async (req, res) => {
  const { qr_payload, vehicle_id } = req.body;
  if (!qr_payload || !vehicle_id) return res.status(400).json({ error: 'qr_payload and vehicle_id are required' });
  try {
    // Find approval
    const approval = await query(`
      SELECT da.*, v.registration, d.full_name AS driver_name
      FROM dispatch_approvals da
      JOIN vehicles v ON v.id = da.vehicle_id
      JOIN drivers  d ON d.id = da.driver_id
      WHERE da.qr_payload = $1 AND da.vehicle_id = $2 AND da.status = 'pending' AND da.expires_at > NOW()
    `, [qr_payload, vehicle_id]);

    if (!approval.rows.length) return res.status(400).json({ error: 'Invalid, expired or already used dispatch approval' });
    const appr = approval.rows[0];

    // Mark approval as used
    await query(`UPDATE dispatch_approvals SET status = 'approved', approved_at = NOW() WHERE id = $1`, [appr.id]);

    // Start a trip
    const tripResult = await query(`
      INSERT INTO trips (tenant_id, vehicle_id, driver_id, status, started_at)
      VALUES ($1,$2,$3,'active',NOW())
      RETURNING id
    `, [req.tenantId, vehicle_id, appr.driver_id]);

    // Update vehicle status
    await query(`UPDATE vehicles SET status = 'active'::vehicle_status, engine_on = true WHERE id = $1`, [vehicle_id]);

    // Log trip started alert
    await query(`
      INSERT INTO alerts (tenant_id, vehicle_id, type, severity, message, occurred_at)
      VALUES ($1,$2,'offline','info',$3,NOW())
    `, [req.tenantId, vehicle_id, `Trip started: ${appr.driver_name} dispatched on bus ${appr.registration}`]).catch(() => {});

    res.json({
      success: true,
      message: 'Trip started successfully',
      trip_id: tripResult.rows[0].id,
      approval: appr,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Driver: End Trip ──────────────────────────────────────────────────────────
// POST /api/mobile/trip/end
router.post('/trip/end', auth, tenantScope, async (req, res) => {
  const { trip_id, vehicle_id, odometer, distance_km } = req.body;
  if (!trip_id || !vehicle_id) return res.status(400).json({ error: 'trip_id and vehicle_id are required' });
  try {
    const result = await query(`
      UPDATE trips SET status = 'completed', completed_at = NOW(),
        distance_km = $1,
        duration_mins = EXTRACT(EPOCH FROM (NOW() - started_at))/60
      WHERE id = $2 AND vehicle_id = $3 AND status = 'active'
      RETURNING *
    `, [distance_km||null, trip_id, vehicle_id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Active trip not found' });

    await query(`UPDATE vehicles SET status = 'idle'::vehicle_status, engine_on = false WHERE id = $1`, [vehicle_id]);

    // Log trip ended
    await query(`
      INSERT INTO alerts (tenant_id, vehicle_id, type, severity, message, occurred_at)
      VALUES ($1,$2,'offline','info',$3,NOW())
    `, [req.tenantId, vehicle_id, `Trip ended for vehicle`]).catch(() => {});

    res.json({ success: true, trip: result.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Supervisor: List buses with QR ───────────────────────────────────────────
// GET /api/mobile/supervisor/buses
router.get('/supervisor/buses', auth, tenantScope, async (req, res) => {
  try {
    const result = await query(`
      SELECT v.id, v.registration, v.make, v.model, v.type, v.status, v.qr_code,
             v.current_fuel, v.current_speed,
             d.id AS driver_id, d.full_name AS driver_name, d.employee_id,
             r.id AS route_id, r.name AS route_name
      FROM vehicles v
      LEFT JOIN drivers d ON v.assigned_driver_id = d.id
      LEFT JOIN routes  r ON v.route_id = r.id
      WHERE ${tw(req.tenantId, 'v')}
      ORDER BY v.registration
    `);
    res.json({ buses: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Shared: Alerts ────────────────────────────────────────────────────────────
// GET /api/mobile/alerts
router.get('/alerts', auth, tenantScope, async (req, res) => {
  try {
    const result = await query(`
      SELECT a.id, a.type, a.severity, a.message, a.occurred_at, a.is_read,
             v.registration AS vehicle_registration
      FROM alerts a
      LEFT JOIN vehicles v ON a.vehicle_id = v.id
      WHERE ${tw(req.tenantId, 'a')}
      ORDER BY a.occurred_at DESC
      LIMIT 50
    `);
    res.json({ alerts: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/mobile/driver/route — get driver's assigned bus route
router.get('/driver/route', auth, tenantScope, async (req, res) => {
  try {
    const result = await query(`
      SELECT r.id, r.name, r.description, r.color, r.distance_km, r.duration_min,
             ST_AsGeoJSON(r.path)::json AS path_geojson,
             v.id AS vehicle_id, v.registration
      FROM drivers d
      JOIN vehicles v ON v.assigned_driver_id = d.id
      JOIN routes r ON v.route_id = r.id
      WHERE d.user_id = $1
    `, [req.userId]);
    if (!result.rows.length) return res.status(404).json({ error: 'No route assigned to your vehicle' });
    res.json({ route: result.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
