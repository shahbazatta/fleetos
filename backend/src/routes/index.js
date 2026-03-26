const { query } = require('../db');
const { auth, tenantScope, canRead, canAssign, canManageFleet, canManageUsers, isSuperadmin } = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');

// Helper
const tw = (tid, alias = '') => {
  const col = alias ? `${alias}.tenant_id` : 'tenant_id';
  return tid ? `${col} = '${tid}'` : '1=1';
};

// ── ALERTS ────────────────────────────────────────────────────────────────────
const alertsRouter = require('express').Router();

alertsRouter.get('/', auth, tenantScope, canRead, async (req, res) => {
  try {
    const { severity, type, unread, limit = 50, offset = 0 } = req.query;
    const conds = [tw(req.tenantId, 'a')]; const params = [];
    if (severity) { params.push(severity); conds.push(`a.severity = $${params.length}`); }
    if (type)     { params.push(type);     conds.push(`a.type = $${params.length}`); }
    if (unread === 'true') conds.push('a.is_read = false');
    params.push(parseInt(limit), parseInt(offset));

    const result = await query(`
      SELECT a.*, ST_X(a.location) AS lng, ST_Y(a.location) AS lat,
             v.registration, v.make, v.model, d.full_name AS driver_name
      FROM alerts a
      LEFT JOIN vehicles v ON a.vehicle_id = v.id
      LEFT JOIN drivers  d ON a.driver_id = d.id
      WHERE ${conds.join(' AND ')}
      ORDER BY a.occurred_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    const countResult = await query(`SELECT COUNT(*) FROM alerts a WHERE ${conds.join(' AND ')}`, params.slice(0, -2));
    res.json({ alerts: result.rows, total: parseInt(countResult.rows[0].count) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

alertsRouter.get('/stats', auth, tenantScope, canRead, async (req, res) => {
  try {
    const result = await query(`
      SELECT
        COUNT(*) FILTER (WHERE is_read = false)                           AS unread,
        COUNT(*) FILTER (WHERE severity = 'critical' AND is_read = false) AS critical,
        COUNT(*) FILTER (WHERE severity = 'warning'  AND is_read = false) AS warning,
        COUNT(*) FILTER (WHERE occurred_at > NOW() - INTERVAL '1 hour')  AS last_hour,
        COUNT(*) FILTER (WHERE occurred_at > NOW() - INTERVAL '24 hours') AS last_24h
      FROM alerts WHERE ${tw(req.tenantId)}
    `);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

alertsRouter.patch('/read-all', auth, tenantScope, canRead, async (req, res) => {
  try {
    await query(`UPDATE alerts SET is_read = true WHERE is_read = false AND ${tw(req.tenantId)}`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

alertsRouter.patch('/:id/read', auth, tenantScope, canRead, async (req, res) => {
  try {
    await query(`UPDATE alerts SET is_read = true WHERE id = $1 AND ${tw(req.tenantId)}`, [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GEOFENCES ─────────────────────────────────────────────────────────────────
const geofencesRouter = require('express').Router();

geofencesRouter.get('/', auth, tenantScope, canRead, async (req, res) => {
  try {
    const result = await query(`
      SELECT id, name, description, color, is_active, alert_on_enter, alert_on_exit, speed_limit,
             ST_AsGeoJSON(boundary)::json AS boundary, ST_Area(boundary::geography) AS area_sqm
      FROM geofences WHERE ${tw(req.tenantId)} ORDER BY name
    `);
    res.json({ geofences: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

geofencesRouter.get('/geojson', auth, tenantScope, canRead, async (req, res) => {
  try {
    const result = await query(`
      SELECT id, name, color, is_active, speed_limit, ST_AsGeoJSON(boundary)::json AS geometry
      FROM geofences WHERE ${tw(req.tenantId)} AND is_active = true
    `);
    res.json({
      type: 'FeatureCollection',
      features: result.rows.map(g => ({
        type: 'Feature', geometry: g.geometry,
        properties: { id: g.id, name: g.name, color: g.color, speed_limit: g.speed_limit },
      })),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

geofencesRouter.post('/', auth, tenantScope, canManageFleet, async (req, res) => {
  const { name, description, color, coordinates, alert_on_enter, alert_on_exit, speed_limit } = req.body;
  if (!req.tenantId) return res.status(400).json({ error: 'Tenant required' });
  try {
    const ring = coordinates.map(c => `${c[0]} ${c[1]}`).join(',');
    const result = await query(`
      INSERT INTO geofences (tenant_id, name, description, color, boundary, alert_on_enter, alert_on_exit, speed_limit)
      VALUES ($1,$2,$3,$4, ST_SetSRID(ST_GeomFromText($5),4326),$6,$7,$8) RETURNING id
    `, [req.tenantId, name, description, color||'#00d4e8', `POLYGON((${ring}))`, alert_on_enter??true, alert_on_exit??true, speed_limit]);
    res.json({ id: result.rows[0].id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

geofencesRouter.delete('/:id', auth, tenantScope, canManageFleet, async (req, res) => {
  try {
    await query(`DELETE FROM geofences WHERE id = $1 AND ${tw(req.tenantId)}`, [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

geofencesRouter.get('/vehicle-status', auth, tenantScope, canRead, async (req, res) => {
  try {
    const result = await query(`
      SELECT g.id AS geofence_id, g.name AS geofence_name,
             v.id AS vehicle_id, v.registration,
             ST_Within(v.current_location, g.boundary) AS inside
      FROM geofences g
      CROSS JOIN vehicles v
      WHERE g.${tw(req.tenantId, 'g').replace('g.', '')} AND v.${tw(req.tenantId, 'v').replace('v.', '')}
        AND g.is_active = true AND v.current_location IS NOT NULL
        AND ST_Within(v.current_location, g.boundary)
    `);
    res.json({ vehicles_in_geofences: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── DRIVERS ───────────────────────────────────────────────────────────────────
const driversRouter = require('express').Router();

driversRouter.get('/', auth, tenantScope, canRead, async (req, res) => {
  try {
    const result = await query(`
      SELECT d.*,
             v.registration AS vehicle_reg, v.make, v.model, v.status AS vehicle_status,
             dp.name AS depot_name,
             COALESCE(
               (SELECT overall_score FROM driver_scores WHERE driver_id = d.id ORDER BY period_date DESC LIMIT 1),
               d.safety_score
             ) AS current_score
      FROM drivers d
      LEFT JOIN vehicles v  ON v.assigned_driver_id = d.id
      LEFT JOIN depots  dp  ON d.depot_id = dp.id
      WHERE ${tw(req.tenantId, 'd')}
      ORDER BY d.safety_score DESC
    `);
    res.json({ drivers: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/drivers/available — unassigned drivers for assignment UI
driversRouter.get('/available', auth, tenantScope, canRead, async (req, res) => {
  try {
    const result = await query(`
      SELECT d.id, d.full_name, d.employee_id, d.phone, d.safety_score, d.license_class
      FROM drivers d
      LEFT JOIN vehicles v ON v.assigned_driver_id = d.id
      WHERE ${tw(req.tenantId, 'd')} AND d.status = 'active' AND v.id IS NULL
      ORDER BY d.full_name
    `);
    res.json({ drivers: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

driversRouter.get('/:id/scores', auth, tenantScope, canRead, async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM driver_scores WHERE driver_id = $1 AND ${tw(req.tenantId)} ORDER BY period_date DESC LIMIT 30`,
      [req.params.id]
    );
    res.json({ scores: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── ANALYTICS ─────────────────────────────────────────────────────────────────
const analyticsRouter = require('express').Router();

analyticsRouter.get('/fleet-summary', auth, tenantScope, canRead, async (req, res) => {
  try {
    if (req.tenantId) {
      const result = await query('SELECT * FROM tenant_kpi($1)', [req.tenantId]);
      const r = result.rows[0];
      res.json({
        vehicles: { total: r.total_vehicles, active: r.active_vehicles, idle: r.idle_vehicles, offline: r.offline_vehicles, avg_speed: r.avg_speed, avg_fuel: r.avg_fuel, avg_health: r.avg_health },
        alerts:   { unread: r.unread_alerts, critical: r.critical_alerts, today: r.unread_alerts },
        drivers:  { avg_safety_score: r.avg_driver_score },
      });
    } else {
      // Superadmin cross-tenant summary
      const [vStats, aStats, dStats] = await Promise.all([
        query(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status='active') AS active, COUNT(*) FILTER (WHERE status='idle') AS idle, COUNT(*) FILTER (WHERE status='offline') AS offline, ROUND(AVG(current_speed) FILTER (WHERE status='active')::numeric,1) AS avg_speed, ROUND(AVG(current_fuel)::numeric,1) AS avg_fuel, ROUND(AVG(health_score)::numeric,1) AS avg_health FROM vehicles`),
        query(`SELECT COUNT(*) FILTER (WHERE is_read=false) AS unread, COUNT(*) FILTER (WHERE severity='critical' AND is_read=false) AS critical, COUNT(*) FILTER (WHERE occurred_at > NOW() - INTERVAL '24 hours') AS today FROM alerts`),
        query(`SELECT ROUND(AVG(safety_score)::numeric,1) AS avg_safety_score FROM drivers WHERE status='active'`),
      ]);
      res.json({ vehicles: vStats.rows[0], alerts: aStats.rows[0], drivers: dStats.rows[0] });
    }
  } catch (err) { res.status(500).json({ error: err.message }); }
});

analyticsRouter.get('/fuel-trend', auth, tenantScope, canRead, async (req, res) => {
  const { days = 7 } = req.query;
  try {
    const result = await query(`
      SELECT DATE_TRUNC('hour', t.recorded_at) AS hour,
             ROUND(AVG(t.fuel_level)::numeric,1) AS avg_fuel,
             ROUND(AVG(t.speed)::numeric,1) AS avg_speed,
             COUNT(DISTINCT t.vehicle_id) AS active_vehicles
      FROM telemetry t
      JOIN vehicles v ON t.vehicle_id = v.id
      WHERE t.recorded_at > NOW() - ($1 || ' days')::INTERVAL AND ${tw(req.tenantId, 'v')}
      GROUP BY DATE_TRUNC('hour', t.recorded_at)
      ORDER BY hour
    `, [days]);
    res.json({ trend: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

analyticsRouter.get('/alert-heatmap', auth, tenantScope, canRead, async (req, res) => {
  try {
    const result = await query(`
      SELECT ROUND(ST_X(ST_SnapToGrid(location, 0.005))::numeric,4) AS lng,
             ROUND(ST_Y(ST_SnapToGrid(location, 0.005))::numeric,4) AS lat,
             COUNT(*) AS count, type, severity
      FROM alerts
      WHERE location IS NOT NULL AND occurred_at > NOW() - INTERVAL '7 days' AND ${tw(req.tenantId)}
      GROUP BY ST_SnapToGrid(location, 0.005), type, severity
      ORDER BY count DESC LIMIT 500
    `);
    res.json({ points: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── AUTH ──────────────────────────────────────────────────────────────────────
const authRouter = require('express').Router();

authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  try {
    const result = await query(`
      SELECT u.*, t.name AS tenant_name, t.slug AS tenant_slug, t.is_active AS tenant_active,
             t.plan, t.max_vehicles, t.max_users, t.settings, t.city, t.country
      FROM users u
      LEFT JOIN tenants t ON u.tenant_id = t.id
      WHERE u.email = $1 AND u.is_active = true
    `, [email.toLowerCase().trim()]);

    if (!result.rows.length) return res.status(401).json({ error: 'Invalid email or password' });
    const user = result.rows[0];

    // Tenant-level users must have an active tenant
    if (user.role !== 'superadmin' && !user.tenant_active) {
      return res.status(403).json({ error: 'Your company account is suspended. Contact support.' });
    }

    const hash = user.password_hash;
    let valid = false;
    if (hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$')) {
      valid = await bcrypt.compare(password, hash);
    } else {
      valid = (password === hash);
    }
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    await query(`UPDATE users SET last_login = NOW() WHERE id = $1`, [user.id]);

    const tokenPayload = {
      id:        user.id,
      email:     user.email,
      role:      user.role,
      name:      user.full_name,
      tenant_id: user.tenant_id || null,
    };
    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET || 'dev_fleet_secret', { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

    res.json({
      token,
      user: {
        id:        user.id,
        email:     user.email,
        role:      user.role,
        name:      user.full_name,
        tenant_id: user.tenant_id,
        tenant:    user.tenant_id ? {
          id:           user.tenant_id,
          name:         user.tenant_name,
          slug:         user.tenant_slug,
          plan:         user.plan,
          max_vehicles: user.max_vehicles,
          max_users:    user.max_users,
          settings:     user.settings,
          city:         user.city    || null,
          country:      user.country || null,
        } : null,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login' });
  }
});

authRouter.get('/me', auth, async (req, res) => {
  try {
    const result = await query(`
      SELECT u.id, u.email, u.full_name, u.role, u.is_active, u.last_login, u.created_at, u.phone,
             t.id AS tenant_id, t.name AS tenant_name, t.slug, t.plan, t.max_vehicles, t.max_users, t.settings
      FROM users u
      LEFT JOIN tenants t ON u.tenant_id = t.id
      WHERE u.id = $1
    `, [req.user.id]);
    const u = result.rows[0];
    res.json({ user: { ...u, tenant: u.tenant_id ? { id: u.tenant_id, name: u.tenant_name, slug: u.slug, plan: u.plan, max_vehicles: u.max_vehicles, max_users: u.max_users } : null } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = { alertsRouter, geofencesRouter, driversRouter, analyticsRouter, authRouter };
