const router = require('express').Router();
const { query } = require('../db');
const { auth, isSuperadmin, tenantScope } = require('../middleware/auth');

// GET /api/tenants — all tenants (superadmin only)
router.get('/', auth, isSuperadmin, async (req, res) => {
  try {
    const result = await query(`
      SELECT
        t.*,
        COUNT(DISTINCT u.id)  FILTER (WHERE u.role != 'superadmin') AS user_count,
        COUNT(DISTINCT v.id)  AS vehicle_count,
        COUNT(DISTINCT d.id)  AS driver_count
      FROM tenants t
      LEFT JOIN users    u ON u.tenant_id = t.id
      LEFT JOIN vehicles v ON v.tenant_id = t.id
      LEFT JOIN drivers  d ON d.tenant_id = t.id
      GROUP BY t.id
      ORDER BY t.created_at DESC
    `);
    res.json({ tenants: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/tenants/:id
router.get('/:id', auth, isSuperadmin, async (req, res) => {
  try {
    const result = await query(`SELECT * FROM tenants WHERE id = $1`, [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Tenant not found' });
    res.json({ tenant: result.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/tenants
router.post('/', auth, isSuperadmin, async (req, res) => {
  const { name, slug, country, city, address, phone, email, website, plan, max_vehicles, max_users } = req.body;
  if (!name || !slug) return res.status(400).json({ error: 'name and slug are required' });
  if (!/^[a-z0-9-]+$/.test(slug)) return res.status(400).json({ error: 'slug must be lowercase letters, numbers and hyphens only' });
  try {
    const existing = await query('SELECT id FROM tenants WHERE slug = $1', [slug]);
    if (existing.rows.length) return res.status(409).json({ error: 'A tenant with this slug already exists' });
    const result = await query(`
      INSERT INTO tenants (name, slug, country, city, address, phone, email, website, plan, max_vehicles, max_users)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *
    `, [name, slug, country||'Pakistan', city, address, phone, email, website, plan||'standard', max_vehicles||50, max_users||10]);
    res.status(201).json({ tenant: result.rows[0], message: 'Tenant created' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/tenants/:id
router.patch('/:id', auth, isSuperadmin, async (req, res) => {
  const fields = ['name','country','city','address','phone','email','website','logo_url','is_active','plan','max_vehicles','max_users','settings'];
  const updates = []; const params = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) { params.push(req.body[f]); updates.push(`${f} = $${params.length}`); }
  }
  if (!updates.length) return res.status(400).json({ error: 'No fields to update' });
  params.push(req.params.id);
  try {
    const result = await query(
      `UPDATE tenants SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${params.length} RETURNING *`,
      params
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Tenant not found' });
    res.json({ tenant: result.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/tenants/:id — hard delete (cascades to all tenant data)
router.delete('/:id', auth, isSuperadmin, async (req, res) => {
  try {
    const result = await query('DELETE FROM tenants WHERE id = $1 RETURNING name', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Tenant not found' });
    res.json({ message: `Tenant "${result.rows[0].name}" deleted` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/tenants/:id/stats — KPI summary for a tenant
router.get('/:id/stats', auth, isSuperadmin, async (req, res) => {
  try {
    const result = await query('SELECT * FROM tenant_kpi($1)', [req.params.id]);
    res.json({ stats: result.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
