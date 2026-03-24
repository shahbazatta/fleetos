const router = require('express').Router();
const { query } = require('../db');
const { auth, tenantScope, canRead, canAssign, canManageFleet } = require('../middleware/auth');

const tw = (tid, alias = 'v') => tid ? `${alias}.tenant_id = '${tid}'` : '1=1';

// GET /api/vehicles
router.get('/', auth, tenantScope, canRead, async (req, res) => {
  try {
    const { status, type, search } = req.query;
    const conds = [tw(req.tenantId)]; const params = [];
    if (status) { params.push(status); conds.push(`v.status = $${params.length}`); }
    if (type)   { params.push(type);   conds.push(`v.type = $${params.length}`); }
    if (search) { params.push(`%${search}%`); conds.push(`(v.registration ILIKE $${params.length} OR v.make ILIKE $${params.length} OR v.model ILIKE $${params.length})`); }

    const result = await query(`
      SELECT v.id, v.tenant_id, v.registration, v.make, v.model, v.year, v.type,
             v.status, v.color, v.current_speed, v.current_heading,
             v.current_fuel, v.current_odometer, v.engine_on, v.health_score, v.last_seen,
             ST_X(v.current_location) AS lng, ST_Y(v.current_location) AS lat,
             ST_AsGeoJSON(v.current_location)::json AS location,
             v.fuel_capacity, v.max_speed, v.payload_capacity,
             v.last_service_date, v.next_service_km,
             d.id AS driver_id, d.full_name AS driver_name,
             d.safety_score AS driver_score, d.phone AS driver_phone,
             dp.name AS depot_name, t.name AS tenant_name,
             COUNT(a.id) FILTER (WHERE a.is_read = false) AS unread_alerts
      FROM vehicles v
      LEFT JOIN drivers d  ON v.assigned_driver_id = d.id
      LEFT JOIN depots  dp ON v.depot_id = dp.id
      LEFT JOIN tenants t  ON v.tenant_id = t.id
      LEFT JOIN alerts  a  ON a.vehicle_id = v.id AND a.occurred_at > NOW() - INTERVAL '24 hours'
      WHERE ${conds.join(' AND ')}
      GROUP BY v.id, d.id, dp.id, t.id
      ORDER BY v.registration
    `, params);
    res.json({ vehicles: result.rows, total: result.rowCount });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/vehicles/geojson
router.get('/geojson', auth, tenantScope, canRead, async (req, res) => {
  try {
    const result = await query(`
      SELECT v.id, v.registration, v.make, v.model, v.status, v.type,
             v.current_speed, v.current_heading, v.current_fuel, v.engine_on,
             v.health_score, v.last_seen, v.tenant_id,
             ST_X(v.current_location) AS lng, ST_Y(v.current_location) AS lat,
             d.full_name AS driver_name, t.name AS tenant_name
      FROM vehicles v
      LEFT JOIN drivers d ON v.assigned_driver_id = d.id
      LEFT JOIN tenants t ON v.tenant_id = t.id
      WHERE ${tw(req.tenantId)} AND v.current_location IS NOT NULL
    `);
    res.json({
      type: 'FeatureCollection',
      features: result.rows.map(v => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [parseFloat(v.lng), parseFloat(v.lat)] },
        properties: {
          id: v.id, registration: v.registration,
          vehicle_name: `${v.make} ${v.model}`, status: v.status, type: v.type,
          speed: v.current_speed, heading: v.current_heading,
          fuel: v.current_fuel, engine_on: v.engine_on,
          health_score: v.health_score, driver_name: v.driver_name,
          tenant_id: v.tenant_id, tenant_name: v.tenant_name, last_seen: v.last_seen,
        },
      })),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/vehicles/:id
router.get('/:id', auth, tenantScope, canRead, async (req, res) => {
  try {
    const result = await query(`
      SELECT v.*, t.name AS tenant_name,
             ST_X(v.current_location) AS lng, ST_Y(v.current_location) AS lat,
             ST_AsGeoJSON(v.current_location)::json AS location,
             d.full_name AS driver_name, d.phone AS driver_phone,
             d.license_number, d.safety_score, dp.name AS depot_name
      FROM vehicles v
      LEFT JOIN tenants t  ON v.tenant_id = t.id
      LEFT JOIN drivers d  ON v.assigned_driver_id = d.id
      LEFT JOIN depots  dp ON v.depot_id = dp.id
      WHERE v.id = $1 AND ${tw(req.tenantId)}
    `, [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Vehicle not found' });
    const tid = result.rows[0].tenant_id;
    const [alerts, trips, maint] = await Promise.all([
      query(`SELECT id, type, severity, title, message, occurred_at, is_read FROM alerts WHERE vehicle_id = $1 AND tenant_id = $2 ORDER BY occurred_at DESC LIMIT 10`, [req.params.id, tid]),
      query(`SELECT id, status, distance_km, duration_mins, started_at, completed_at, origin_address, dest_address FROM trips WHERE vehicle_id = $1 ORDER BY started_at DESC LIMIT 5`, [req.params.id]),
      query(`SELECT * FROM maintenance WHERE vehicle_id = $1 ORDER BY scheduled_date DESC LIMIT 5`, [req.params.id]),
    ]);
    res.json({ vehicle: result.rows[0], alerts: alerts.rows, trips: trips.rows, maintenance: maint.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/vehicles/:id/telemetry
router.get('/:id/telemetry', auth, tenantScope, canRead, async (req, res) => {
  const { limit = 100, since } = req.query;
  try {
    const vCheck = await query(`SELECT id FROM vehicles WHERE id = $1 AND ${tw(req.tenantId)}`, [req.params.id]);
    if (!vCheck.rows.length) return res.status(404).json({ error: 'Vehicle not found' });
    let q = `SELECT id, recorded_at, ST_X(location) AS lng, ST_Y(location) AS lat, speed, heading, fuel_level, odometer, engine_on FROM telemetry WHERE vehicle_id = $1`;
    const params = [req.params.id];
    if (since) { params.push(since); q += ` AND recorded_at > $${params.length}`; }
    q += ` ORDER BY recorded_at DESC LIMIT $${params.length + 1}`;
    params.push(parseInt(limit));
    const result = await query(q, params);
    res.json({ telemetry: result.rows.reverse() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/vehicles/:id/trail
router.get('/:id/trail', auth, tenantScope, canRead, async (req, res) => {
  const { minutes = 60 } = req.query;
  try {
    const vCheck = await query(`SELECT id FROM vehicles WHERE id = $1 AND ${tw(req.tenantId)}`, [req.params.id]);
    if (!vCheck.rows.length) return res.status(404).json({ error: 'Vehicle not found' });
    const result = await query(`
      SELECT ST_AsGeoJSON(ST_MakeLine(location ORDER BY recorded_at))::json AS trail,
             COUNT(*) AS points, MIN(recorded_at) AS start_time, MAX(recorded_at) AS end_time,
             ROUND(AVG(speed)::numeric, 1) AS avg_speed, MAX(speed) AS max_speed
      FROM telemetry WHERE vehicle_id = $1 AND recorded_at > NOW() - ($2 || ' minutes')::INTERVAL
    `, [req.params.id, minutes]);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/vehicles/:id/assign — operator+: assign/unassign driver
router.patch('/:id/assign', auth, tenantScope, canAssign, async (req, res) => {
  const { driver_id } = req.body;
  try {
    const vCheck = await query(`SELECT id FROM vehicles WHERE id = $1 AND ${tw(req.tenantId)}`, [req.params.id]);
    if (!vCheck.rows.length) return res.status(404).json({ error: 'Vehicle not found' });
    if (driver_id) {
      const dCheck = await query(`SELECT id FROM drivers WHERE id = $1 AND tenant_id = '${req.tenantId}'`, [driver_id]);
      if (!dCheck.rows.length) return res.status(404).json({ error: 'Driver not found in your fleet' });
    }
    await query(`UPDATE vehicles SET assigned_driver_id = $1, updated_at = NOW() WHERE id = $2`, [driver_id || null, req.params.id]);
    res.json({ success: true, message: driver_id ? 'Driver assigned' : 'Driver unassigned' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/vehicles/:id — admin+: full update
router.patch('/:id', auth, tenantScope, canManageFleet, async (req, res) => {
  const { assigned_driver_id, depot_id, status } = req.body;
  try {
    const updates = []; const params = [];
    if (assigned_driver_id !== undefined) { params.push(assigned_driver_id); updates.push(`assigned_driver_id = $${params.length}`); }
    if (depot_id  !== undefined)          { params.push(depot_id);           updates.push(`depot_id = $${params.length}`); }
    if (status    !== undefined)          { params.push(status);             updates.push(`status = $${params.length}`); }
    if (!updates.length) return res.status(400).json({ error: 'No fields to update' });
    params.push(req.params.id);
    await query(`UPDATE vehicles SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${params.length} AND ${tw(req.tenantId)}`, params);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
