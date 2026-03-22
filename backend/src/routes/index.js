// ── alerts.js ────────────────────────────────────────────────────────────────
const alertsRouter = require('express').Router();
const { query } = require('../db');
const { auth } = require('../middleware/auth');

alertsRouter.get('/', auth, async (req, res) => {
  try {
    const { severity, type, unread, limit = 50, offset = 0 } = req.query;
    const conditions = ['1=1']; const params = [];
    if (severity) { params.push(severity); conditions.push(`a.severity = $${params.length}`); }
    if (type)     { params.push(type);     conditions.push(`a.type = $${params.length}`); }
    if (unread === 'true') conditions.push('a.is_read = false');
    params.push(parseInt(limit), parseInt(offset));

    const result = await query(`
      SELECT a.*,
             ST_X(a.location) AS lng, ST_Y(a.location) AS lat,
             v.registration, v.make, v.model,
             d.full_name AS driver_name
      FROM alerts a
      LEFT JOIN vehicles v ON a.vehicle_id = v.id
      LEFT JOIN drivers d  ON a.driver_id = d.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY a.occurred_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    const countResult = await query(`SELECT COUNT(*) FROM alerts a WHERE ${conditions.join(' AND ')}`, params.slice(0,-2));
    res.json({ alerts: result.rows, total: parseInt(countResult.rows[0].count) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

alertsRouter.get('/stats', auth, async (req, res) => {
  try {
    const result = await query(`
      SELECT
        COUNT(*) FILTER (WHERE is_read = false) AS unread,
        COUNT(*) FILTER (WHERE severity = 'critical' AND is_read = false) AS critical,
        COUNT(*) FILTER (WHERE severity = 'warning' AND is_read = false) AS warning,
        COUNT(*) FILTER (WHERE occurred_at > NOW() - INTERVAL '1 hour') AS last_hour,
        COUNT(*) FILTER (WHERE occurred_at > NOW() - INTERVAL '24 hours') AS last_24h
      FROM alerts
    `);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

alertsRouter.patch('/:id/read', auth, async (req, res) => {
  try {
    await query(`UPDATE alerts SET is_read = true WHERE id = $1`, [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

alertsRouter.patch('/read-all', auth, async (req, res) => {
  try {
    await query(`UPDATE alerts SET is_read = true WHERE is_read = false`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── geofences.js ─────────────────────────────────────────────────────────────
const geofencesRouter = require('express').Router();

geofencesRouter.get('/', auth, async (req, res) => {
  try {
    const result = await query(`
      SELECT id, name, description, color, is_active, alert_on_enter, alert_on_exit, speed_limit,
             ST_AsGeoJSON(boundary)::json AS boundary,
             ST_Area(boundary::geography) AS area_sqm,
             ST_AsText(ST_Centroid(boundary)) AS centroid_wkt
      FROM geofences ORDER BY name
    `);
    res.json({ geofences: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

geofencesRouter.get('/geojson', auth, async (req, res) => {
  try {
    const result = await query(`
      SELECT id, name, color, is_active, speed_limit,
             ST_AsGeoJSON(boundary)::json AS geometry
      FROM geofences WHERE is_active = true
    `);
    res.json({
      type: 'FeatureCollection',
      features: result.rows.map(g => ({
        type: 'Feature',
        geometry: g.geometry,
        properties: { id: g.id, name: g.name, color: g.color, speed_limit: g.speed_limit }
      }))
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

geofencesRouter.post('/', auth, async (req, res) => {
  const { name, description, color, coordinates, alert_on_enter, alert_on_exit, speed_limit } = req.body;
  try {
    const ring = coordinates.map(c => `${c[0]} ${c[1]}`).join(',');
    const wkt = `POLYGON((${ring}))`;
    const result = await query(`
      INSERT INTO geofences (name, description, color, boundary, alert_on_enter, alert_on_exit, speed_limit)
      VALUES ($1, $2, $3, ST_SetSRID(ST_GeomFromText($4), 4326), $5, $6, $7)
      RETURNING id
    `, [name, description, color || '#00d4e8', wkt, alert_on_enter ?? true, alert_on_exit ?? true, speed_limit]);
    res.json({ id: result.rows[0].id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

geofencesRouter.delete('/:id', auth, async (req, res) => {
  try {
    await query(`DELETE FROM geofences WHERE id = $1`, [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Check which vehicles are inside each geofence (PostGIS spatial join)
geofencesRouter.get('/vehicle-status', auth, async (req, res) => {
  try {
    const result = await query(`
      SELECT
        g.id AS geofence_id, g.name AS geofence_name,
        v.id AS vehicle_id, v.registration,
        ST_Within(v.current_location, g.boundary) AS inside
      FROM geofences g
      CROSS JOIN vehicles v
      WHERE g.is_active = true
        AND v.current_location IS NOT NULL
        AND ST_Within(v.current_location, g.boundary)
    `);
    res.json({ vehicles_in_geofences: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── drivers.js ───────────────────────────────────────────────────────────────
const driversRouter = require('express').Router();

driversRouter.get('/', auth, async (req, res) => {
  try {
    const result = await query(`
      SELECT
        d.*,
        v.registration AS vehicle_reg, v.make, v.model,
        v.status AS vehicle_status,
        dp.name AS depot_name,
        COALESCE(
          (SELECT overall_score FROM driver_scores WHERE driver_id = d.id ORDER BY period_date DESC LIMIT 1),
          d.safety_score
        ) AS current_score
      FROM drivers d
      LEFT JOIN vehicles v ON v.assigned_driver_id = d.id
      LEFT JOIN depots dp  ON d.depot_id = dp.id
      ORDER BY d.safety_score DESC
    `);
    res.json({ drivers: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

driversRouter.get('/:id/scores', auth, async (req, res) => {
  try {
    const result = await query(`
      SELECT * FROM driver_scores
      WHERE driver_id = $1
      ORDER BY period_date DESC
      LIMIT 30
    `, [req.params.id]);
    res.json({ scores: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── analytics.js ─────────────────────────────────────────────────────────────
const analyticsRouter = require('express').Router();

analyticsRouter.get('/fleet-summary', auth, async (req, res) => {
  try {
    const [vStats, aStats, dStats] = await Promise.all([
      query(`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE status = 'active')  AS active,
          COUNT(*) FILTER (WHERE status = 'idle')    AS idle,
          COUNT(*) FILTER (WHERE status = 'offline') AS offline,
          COUNT(*) FILTER (WHERE status = 'maintenance') AS maintenance,
          ROUND(AVG(current_speed) FILTER (WHERE status = 'active')::numeric, 1) AS avg_speed,
          ROUND(AVG(current_fuel)::numeric, 1) AS avg_fuel,
          ROUND(AVG(health_score)::numeric, 1) AS avg_health
        FROM vehicles
      `),
      query(`
        SELECT
          COUNT(*) FILTER (WHERE is_read = false) AS unread,
          COUNT(*) FILTER (WHERE severity = 'critical' AND is_read = false) AS critical,
          COUNT(*) FILTER (WHERE occurred_at > NOW() - INTERVAL '24 hours') AS today
        FROM alerts
      `),
      query(`
        SELECT ROUND(AVG(safety_score)::numeric, 1) AS avg_safety_score
        FROM drivers WHERE status = 'active'
      `),
    ]);
    res.json({
      vehicles: vStats.rows[0],
      alerts: aStats.rows[0],
      drivers: dStats.rows[0],
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

analyticsRouter.get('/fuel-trend', auth, async (req, res) => {
  const { days = 7 } = req.query;
  try {
    const result = await query(`
      SELECT
        DATE_TRUNC('hour', recorded_at) AS hour,
        ROUND(AVG(fuel_level)::numeric, 1) AS avg_fuel,
        ROUND(AVG(speed)::numeric, 1) AS avg_speed,
        COUNT(DISTINCT vehicle_id) AS active_vehicles
      FROM telemetry
      WHERE recorded_at > NOW() - ($1 || ' days')::INTERVAL
      GROUP BY DATE_TRUNC('hour', recorded_at)
      ORDER BY hour
    `, [days]);
    res.json({ trend: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

analyticsRouter.get('/alert-heatmap', auth, async (req, res) => {
  try {
    const result = await query(`
      SELECT
        ST_X(location) AS lng,
        ST_Y(location) AS lat,
        COUNT(*) AS count,
        type, severity
      FROM alerts
      WHERE location IS NOT NULL
        AND occurred_at > NOW() - INTERVAL '7 days'
      GROUP BY ST_SnapToGrid(location, 0.005), type, severity
      ORDER BY count DESC
      LIMIT 500
    `);
    res.json({ points: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── auth.js ──────────────────────────────────────────────────────────────────
const authRouter = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  try {
    const result = await query(`SELECT * FROM users WHERE email = $1 AND is_active = true`, [email]);
    if (!result.rows.length) return res.status(401).json({ error: 'Invalid credentials' });
    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    await query(`UPDATE users SET last_login = NOW() WHERE id = $1`, [user.id]);
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.full_name },
      process.env.JWT_SECRET || 'dev_secret',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
    res.json({ token, user: { id: user.id, email: user.email, role: user.role, name: user.full_name } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

authRouter.get('/me', auth, async (req, res) => {
  try {
    const result = await query(`SELECT id, email, full_name, role, last_login FROM users WHERE id = $1`, [req.user.id]);
    res.json({ user: result.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = { alertsRouter, geofencesRouter, driversRouter, analyticsRouter, authRouter };
