// fleet-management.js  — Full CRUD for Drivers, Vehicles, Geofences, Depots
const router = require('express').Router();
const { query } = require('../db');
const { auth, tenantScope, canRead, canAssign, canManageFleet } = require('../middleware/auth');

const tw = (tid, alias = '') => {
  const col = alias ? `${alias}.tenant_id` : 'tenant_id';
  return tid ? `${col} = '${tid}'` : '1=1';
};

// ══════════════════════════════════════════════════════════════════
// DEPOTS
// ══════════════════════════════════════════════════════════════════

router.get('/depots', auth, tenantScope, canRead, async (req, res) => {
  try {
    const result = await query(`
      SELECT d.*,
             ST_X(d.location) AS lng, ST_Y(d.location) AS lat,
             COUNT(DISTINCT v.id) AS vehicle_count,
             COUNT(DISTINCT dr.id) AS driver_count
      FROM depots d
      LEFT JOIN vehicles v  ON v.depot_id = d.id
      LEFT JOIN drivers  dr ON dr.depot_id = d.id
      WHERE ${tw(req.tenantId, 'd')}
      GROUP BY d.id
      ORDER BY d.name
    `);
    res.json({ depots: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/depots', auth, tenantScope, canManageFleet, async (req, res) => {
  const { name, address, city, lng, lat, capacity, manager, phone } = req.body;
  if (!name || lng == null || lat == null) return res.status(400).json({ error: 'name, lng and lat are required' });
  if (!req.tenantId) return res.status(400).json({ error: 'Tenant required' });
  try {
    const result = await query(`
      INSERT INTO depots (tenant_id, name, address, city, location, capacity, manager, phone)
      VALUES ($1,$2,$3,$4, ST_SetSRID(ST_MakePoint($5,$6),4326),$7,$8,$9)
      RETURNING *, ST_X(location) AS lng, ST_Y(location) AS lat
    `, [req.tenantId, name, address||null, city||null, lng, lat, capacity||50, manager||null, phone||null]);
    res.status(201).json({ depot: result.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/depots/:id', auth, tenantScope, canManageFleet, async (req, res) => {
  const fields = ['name','address','city','capacity','manager','phone','is_active'];
  const updates = []; const params = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) { params.push(req.body[f]); updates.push(`${f} = $${params.length}`); }
  }
  // location update
  if (req.body.lng != null && req.body.lat != null) {
    params.push(req.body.lng, req.body.lat);
    updates.push(`location = ST_SetSRID(ST_MakePoint($${params.length-1},$${params.length}),4326)`);
  }
  if (!updates.length) return res.status(400).json({ error: 'No fields to update' });
  params.push(req.params.id);
  try {
    const result = await query(
      `UPDATE depots SET ${updates.join(', ')} WHERE id = $${params.length} AND ${tw(req.tenantId)}
       RETURNING *, ST_X(location) AS lng, ST_Y(location) AS lat`,
      params
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Depot not found' });
    res.json({ depot: result.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/depots/:id', auth, tenantScope, canManageFleet, async (req, res) => {
  try {
    // Unassign before deleting
    await query(`UPDATE vehicles SET depot_id = NULL WHERE depot_id = $1`, [req.params.id]);
    await query(`UPDATE drivers  SET depot_id = NULL WHERE depot_id = $1`, [req.params.id]);
    const result = await query(`DELETE FROM depots WHERE id = $1 AND ${tw(req.tenantId)} RETURNING name`, [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Depot not found' });
    res.json({ message: `Depot "${result.rows[0].name}" deleted` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ══════════════════════════════════════════════════════════════════
// DRIVERS — full CRUD + vehicle assignment
// ══════════════════════════════════════════════════════════════════

router.get('/drivers', auth, tenantScope, canRead, async (req, res) => {
  try {
    const { status, search } = req.query;
    const conds = [tw(req.tenantId, 'd')]; const params = [];
    if (status) { params.push(status); conds.push(`d.status = $${params.length}`); }
    if (search) { params.push(`%${search}%`); conds.push(`(d.full_name ILIKE $${params.length} OR d.employee_id ILIKE $${params.length} OR d.phone ILIKE $${params.length})`); }

    const result = await query(`
      SELECT d.*,
             v.id   AS vehicle_id,  v.registration AS vehicle_reg,
             v.make AS vehicle_make, v.model AS vehicle_model, v.status AS vehicle_status,
             dp.id AS depot_id, dp.name AS depot_name,
             COALESCE((SELECT overall_score FROM driver_scores WHERE driver_id = d.id ORDER BY period_date DESC LIMIT 1), d.safety_score) AS current_score
      FROM drivers d
      LEFT JOIN vehicles v  ON v.assigned_driver_id = d.id
      LEFT JOIN depots   dp ON d.depot_id = dp.id
      WHERE ${conds.join(' AND ')}
      ORDER BY d.full_name
    `, params);
    res.json({ drivers: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/drivers/:id', auth, tenantScope, canRead, async (req, res) => {
  try {
    const result = await query(`
      SELECT d.*, v.registration AS vehicle_reg, dp.name AS depot_name
      FROM drivers d
      LEFT JOIN vehicles v ON v.assigned_driver_id = d.id
      LEFT JOIN depots  dp ON d.depot_id = dp.id
      WHERE d.id = $1 AND ${tw(req.tenantId, 'd')}
    `, [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Driver not found' });
    res.json({ driver: result.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/drivers', auth, tenantScope, canManageFleet, async (req, res) => {
  const { employee_id, full_name, phone, email, license_number, license_class, license_expiry, depot_id, emergency_contact } = req.body;
  if (!employee_id || !full_name || !license_number || !license_expiry) {
    return res.status(400).json({ error: 'employee_id, full_name, license_number and license_expiry are required' });
  }
  if (!req.tenantId) return res.status(400).json({ error: 'Tenant required' });
  try {
    const result = await query(`
      INSERT INTO drivers (tenant_id, employee_id, full_name, phone, email, license_number, license_class, license_expiry, depot_id, emergency_contact)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *
    `, [req.tenantId, employee_id, full_name, phone||null, email||null, license_number, license_class||'LTV', license_expiry, depot_id||null, emergency_contact||null]);
    res.status(201).json({ driver: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Employee ID or license number already exists in this organisation' });
    res.status(500).json({ error: err.message });
  }
});

router.patch('/drivers/:id', auth, tenantScope, canManageFleet, async (req, res) => {
  const fields = ['full_name','phone','email','license_number','license_class','license_expiry','status','depot_id','emergency_contact'];
  const updates = []; const params = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) { params.push(req.body[f] === '' ? null : req.body[f]); updates.push(`${f} = $${params.length}`); }
  }
  if (!updates.length) return res.status(400).json({ error: 'No fields to update' });
  params.push(req.params.id);
  try {
    const result = await query(
      `UPDATE drivers SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${params.length} AND ${tw(req.tenantId)} RETURNING *`,
      params
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Driver not found' });
    res.json({ driver: result.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/drivers/:id', auth, tenantScope, canManageFleet, async (req, res) => {
  try {
    await query(`UPDATE vehicles SET assigned_driver_id = NULL WHERE assigned_driver_id = $1`, [req.params.id]);
    const result = await query(`DELETE FROM drivers WHERE id = $1 AND ${tw(req.tenantId)} RETURNING full_name`, [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Driver not found' });
    res.json({ message: `Driver "${result.rows[0].full_name}" deleted` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /fm/drivers/:id/assign — assign driver to a vehicle (operator+)
router.patch('/drivers/:id/assign', auth, tenantScope, canAssign, async (req, res) => {
  const { vehicle_id } = req.body; // null to unassign
  try {
    const dCheck = await query(`SELECT id FROM drivers WHERE id = $1 AND ${tw(req.tenantId, 'd')}`.replace('d.', ''), [req.params.id]);
    if (!dCheck.rows.length) return res.status(404).json({ error: 'Driver not found' });
    if (vehicle_id) {
      const vCheck = await query(`SELECT id FROM vehicles WHERE id = $1 AND ${tw(req.tenantId)}`, [vehicle_id]);
      if (!vCheck.rows.length) return res.status(404).json({ error: 'Vehicle not found' });
      // Unassign the driver from any current vehicle first
      await query(`UPDATE vehicles SET assigned_driver_id = NULL WHERE assigned_driver_id = $1`, [req.params.id]);
      // Unassign any driver currently in the target vehicle
      await query(`UPDATE vehicles SET assigned_driver_id = NULL WHERE id = $1`, [vehicle_id]);
      await query(`UPDATE vehicles SET assigned_driver_id = $1, updated_at = NOW() WHERE id = $2`, [req.params.id, vehicle_id]);
    } else {
      await query(`UPDATE vehicles SET assigned_driver_id = NULL WHERE assigned_driver_id = $1`, [req.params.id]);
    }
    res.json({ success: true, message: vehicle_id ? 'Driver assigned to vehicle' : 'Driver unassigned' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ══════════════════════════════════════════════════════════════════
// VEHICLES — full CRUD
// ══════════════════════════════════════════════════════════════════

router.get('/vehicles', auth, tenantScope, canRead, async (req, res) => {
  try {
    const { status, type, search } = req.query;
    const conds = [tw(req.tenantId, 'v')]; const params = [];
    if (status) { params.push(status); conds.push(`v.status = $${params.length}`); }
    if (type)   { params.push(type);   conds.push(`v.type = $${params.length}`); }
    if (search) { params.push(`%${search}%`); conds.push(`(v.registration ILIKE $${params.length} OR v.make ILIKE $${params.length} OR v.model ILIKE $${params.length})`); }

    const result = await query(`
      SELECT v.*,
             ST_X(v.current_location) AS lng, ST_Y(v.current_location) AS lat,
             d.id AS driver_id, d.full_name AS driver_name, d.phone AS driver_phone,
             dp.id AS depot_id, dp.name AS depot_name
      FROM vehicles v
      LEFT JOIN drivers d  ON v.assigned_driver_id = d.id
      LEFT JOIN depots  dp ON v.depot_id = dp.id
      WHERE ${conds.join(' AND ')}
      ORDER BY v.registration
    `, params);
    res.json({ vehicles: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/vehicles', auth, tenantScope, canManageFleet, async (req, res) => {
  const { registration, make, model, year, type, color, vin, fuel_capacity, fuel_type, max_speed, payload_capacity, seats, depot_id, insurance_expiry, registration_expiry, purchase_date, notes } = req.body;
  if (!registration || !make || !model || !year) return res.status(400).json({ error: 'registration, make, model and year are required' });
  if (!req.tenantId) return res.status(400).json({ error: 'Tenant required' });
  try {
    const result = await query(`
      INSERT INTO vehicles (tenant_id, registration, make, model, year, type, color, vin, fuel_capacity, fuel_type, max_speed, payload_capacity, seats, depot_id, insurance_expiry, registration_expiry, purchase_date, notes, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,'offline')
      RETURNING *
    `, [req.tenantId, registration.toUpperCase(), make, model, year, type||'truck', color||null, vin||null, fuel_capacity||60, fuel_type||'diesel', max_speed||120, payload_capacity||null, seats||null, depot_id||null, insurance_expiry||null, registration_expiry||null, purchase_date||null, notes||null]);
    res.status(201).json({ vehicle: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'A vehicle with this registration already exists in this organisation' });
    res.status(500).json({ error: err.message });
  }
});

router.patch('/vehicles/:id', auth, tenantScope, canManageFleet, async (req, res) => {
  const fields = ['make','model','year','type','color','vin','fuel_capacity','fuel_type','max_speed','payload_capacity','seats','depot_id','status','insurance_expiry','registration_expiry','notes','last_service_date','next_service_km'];
  const updates = []; const params = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) { params.push(req.body[f] === '' ? null : req.body[f]); updates.push(`${f} = $${params.length}`); }
  }
  if (!updates.length) return res.status(400).json({ error: 'No fields to update' });
  params.push(req.params.id);
  try {
    const result = await query(
      `UPDATE vehicles SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${params.length} AND ${tw(req.tenantId)} RETURNING *`,
      params
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Vehicle not found' });
    res.json({ vehicle: result.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/vehicles/:id', auth, tenantScope, canManageFleet, async (req, res) => {
  try {
    // Cascade: remove trips and alerts (FK ON DELETE CASCADE handles it)
    const result = await query(`DELETE FROM vehicles WHERE id = $1 AND ${tw(req.tenantId)} RETURNING registration`, [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Vehicle not found' });
    res.json({ message: `Vehicle "${result.rows[0].registration}" deleted` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /fm/vehicles/:id/assign-driver — operator+
router.patch('/vehicles/:id/assign-driver', auth, tenantScope, canAssign, async (req, res) => {
  const { driver_id } = req.body;
  try {
    const vCheck = await query(`SELECT id FROM vehicles WHERE id = $1 AND ${tw(req.tenantId)}`, [req.params.id]);
    if (!vCheck.rows.length) return res.status(404).json({ error: 'Vehicle not found' });
    if (driver_id) {
      const dCheck = await query(`SELECT id FROM drivers WHERE id = $1 AND ${tw(req.tenantId)}`, [driver_id]);
      if (!dCheck.rows.length) return res.status(404).json({ error: 'Driver not found' });
      await query(`UPDATE vehicles SET assigned_driver_id = NULL WHERE assigned_driver_id = $1`, [driver_id]);
    }
    await query(`UPDATE vehicles SET assigned_driver_id = $1, updated_at = NOW() WHERE id = $2`, [driver_id||null, req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ══════════════════════════════════════════════════════════════════
// GEOFENCES — full CRUD
// ══════════════════════════════════════════════════════════════════

router.get('/geofences', auth, tenantScope, canRead, async (req, res) => {
  try {
    const result = await query(`
      SELECT id, name, description, color, zone_type, is_active, alert_on_enter, alert_on_exit, speed_limit,
             ST_AsGeoJSON(boundary)::json AS boundary,
             ROUND(ST_Area(boundary::geography)::numeric, 0) AS area_sqm,
             ST_AsText(ST_Centroid(boundary)) AS centroid_wkt,
             tenant_id
      FROM geofences WHERE ${tw(req.tenantId)} ORDER BY name
    `);
    res.json({ geofences: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/geofences', auth, tenantScope, canManageFleet, async (req, res) => {
  const { name, description, color, zone_type, coordinates, alert_on_enter, alert_on_exit, speed_limit } = req.body;
  if (!name || !coordinates?.length) return res.status(400).json({ error: 'name and coordinates are required' });
  if (!req.tenantId) return res.status(400).json({ error: 'Tenant required' });
  try {
    const ring = coordinates.map((c) => `${c[0]} ${c[1]}`).join(',');
    const result = await query(`
      INSERT INTO geofences (tenant_id, name, description, color, zone_type, boundary, alert_on_enter, alert_on_exit, speed_limit)
      VALUES ($1,$2,$3,$4,$5, ST_SetSRID(ST_GeomFromText($6),4326),$7,$8,$9)
      RETURNING id, name, description, color, zone_type, is_active, alert_on_enter, alert_on_exit, speed_limit,
                ST_AsGeoJSON(boundary)::json AS boundary
    `, [req.tenantId, name, description||null, color||'#00d4e8', zone_type||'delivery', `POLYGON((${ring}))`, alert_on_enter??true, alert_on_exit??true, speed_limit||null]);
    res.status(201).json({ geofence: result.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/geofences/:id', auth, tenantScope, canManageFleet, async (req, res) => {
  const fields = ['name','description','color','zone_type','is_active','alert_on_enter','alert_on_exit','speed_limit'];
  const updates = []; const params = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) { params.push(req.body[f]); updates.push(`${f} = $${params.length}`); }
  }
  if (req.body.coordinates?.length) {
    // Line 318 - Fixed for plain JavaScript
    const ring = req.body.coordinates
    .map((c) => `${c[0]} ${c[1]}`)
    .join(',');
    params.push(`POLYGON((${ring}))`);
    updates.push(`boundary = ST_SetSRID(ST_GeomFromText($${params.length}),4326)`);
  }
  if (!updates.length) return res.status(400).json({ error: 'No fields to update' });
  params.push(req.params.id);
  try {
    const result = await query(
      `UPDATE geofences SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${params.length} AND ${tw(req.tenantId)}
       RETURNING id, name, description, color, zone_type, is_active, alert_on_enter, alert_on_exit, speed_limit, ST_AsGeoJSON(boundary)::json AS boundary`,
      params
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Geofence not found' });
    res.json({ geofence: result.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/geofences/:id', auth, tenantScope, canManageFleet, async (req, res) => {
  try {
    const result = await query(`DELETE FROM geofences WHERE id = $1 AND ${tw(req.tenantId)} RETURNING name`, [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Geofence not found' });
    res.json({ message: `Geofence "${result.rows[0].name}" deleted` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /fm/summary — counts for the management page header
router.get('/summary', auth, tenantScope, canRead, async (req, res) => {
  try {
    const [drivers, vehicles, geofences, depots] = await Promise.all([
      query(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status='active') AS active FROM drivers WHERE ${tw(req.tenantId)}`),
      query(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status='active') AS active FROM vehicles WHERE ${tw(req.tenantId)}`),
      query(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE is_active=true) AS active FROM geofences WHERE ${tw(req.tenantId)}`),
      query(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE is_active=true) AS active FROM depots WHERE ${tw(req.tenantId)}`),
    ]);
    res.json({
      drivers:   drivers.rows[0],
      vehicles:  vehicles.rows[0],
      geofences: geofences.rows[0],
      depots:    depots.rows[0],
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
