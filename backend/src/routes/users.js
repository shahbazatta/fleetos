const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const { auth, tenantScope, canManageUsers, isSuperadmin, permissions } = require('../middleware/auth');

const ROLES = ['viewer', 'operator', 'admin', 'superadmin'];

// GET /api/users — scoped to tenant (superadmin sees all or filters by ?tenant_id=)
router.get('/', auth, tenantScope, canManageUsers, async (req, res) => {
  try {
    const isSA = permissions.isSuperadmin(req.user);
    const whereClause = req.tenantId
      ? `WHERE u.tenant_id = '${req.tenantId}'`
      : isSA ? '' : 'WHERE 1=0';

    const result = await query(`
      SELECT u.id, u.email, u.full_name, u.role, u.is_active,
             u.last_login, u.created_at, u.phone, u.tenant_id,
             t.name AS tenant_name, t.slug AS tenant_slug
      FROM users u
      LEFT JOIN tenants t ON u.tenant_id = t.id
      ${whereClause}
      ORDER BY CASE u.role WHEN 'superadmin' THEN 0 WHEN 'admin' THEN 1 WHEN 'operator' THEN 2 ELSE 3 END, u.full_name
    `);
    res.json({ users: result.rows, total: result.rowCount });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/users
router.post('/', auth, tenantScope, canManageUsers, async (req, res) => {
  const { email, password, full_name, role = 'operator', phone, tenant_id } = req.body;
  if (!email || !password || !full_name) return res.status(400).json({ error: 'email, password and full_name are required' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  if (!ROLES.includes(role)) return res.status(400).json({ error: `Invalid role` });

  // Role creation rules
  if (role === 'superadmin' && !permissions.isSuperadmin(req.user)) return res.status(403).json({ error: 'Only superadmins can create superadmin accounts' });
  if (role === 'admin' && !permissions.isSuperadmin(req.user)) return res.status(403).json({ error: 'Only superadmins can create admin accounts' });

  // Determine target tenant
  const targetTenant = permissions.isSuperadmin(req.user) && tenant_id ? tenant_id : req.tenantId;
  if (!targetTenant && role !== 'superadmin') return res.status(400).json({ error: 'tenant_id is required' });

  try {
    // Check tenant user limit
    if (targetTenant) {
      const limitCheck = await query(`
        SELECT t.max_users, COUNT(u.id) AS current_count
        FROM tenants t LEFT JOIN users u ON u.tenant_id = t.id
        WHERE t.id = $1 GROUP BY t.max_users
      `, [targetTenant]);
      if (limitCheck.rows.length && parseInt(limitCheck.rows[0].current_count) >= parseInt(limitCheck.rows[0].max_users)) {
        return res.status(429).json({ error: `Tenant user limit (${limitCheck.rows[0].max_users}) reached. Upgrade your plan to add more users.` });
      }
    }

    const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (existing.rows.length) return res.status(409).json({ error: 'A user with this email already exists' });

    const hash = await bcrypt.hash(password, 10);
    const result = await query(`
      INSERT INTO users (email, password_hash, full_name, role, phone, tenant_id, is_active)
      VALUES ($1,$2,$3,$4,$5,$6,true)
      RETURNING id, email, full_name, role, is_active, created_at, phone, tenant_id
    `, [email.toLowerCase().trim(), hash, full_name.trim(), role, phone||null, targetTenant||null]);

    res.status(201).json({ user: result.rows[0], message: 'User created successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/users/:id
router.patch('/:id', auth, tenantScope, canManageUsers, async (req, res) => {
  const { full_name, role, is_active, phone, password } = req.body;
  try {
    const existing = await query('SELECT * FROM users WHERE id = $1', [req.params.id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'User not found' });
    const target = existing.rows[0];

    // Enforce tenant boundary
    if (!permissions.isSuperadmin(req.user) && target.tenant_id !== req.tenantId) {
      return res.status(403).json({ error: 'Cannot modify users outside your organisation' });
    }
    if (req.params.id === req.user.id && role && role !== req.user.role) {
      return res.status(400).json({ error: 'You cannot change your own role' });
    }
    if (role && ['admin','superadmin'].includes(role) && !permissions.isSuperadmin(req.user)) {
      return res.status(403).json({ error: 'Only superadmins can assign admin or superadmin roles' });
    }

    const updates = []; const params = [];
    if (full_name  !== undefined) { params.push(full_name.trim()); updates.push(`full_name = $${params.length}`); }
    if (role       !== undefined) { params.push(role);             updates.push(`role = $${params.length}`); }
    if (is_active  !== undefined) { params.push(is_active);        updates.push(`is_active = $${params.length}`); }
    if (phone      !== undefined) { params.push(phone||null);       updates.push(`phone = $${params.length}`); }
    if (password) {
      if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
      params.push(await bcrypt.hash(password, 10));
      updates.push(`password_hash = $${params.length}`);
    }
    if (!updates.length) return res.status(400).json({ error: 'No fields to update' });
    params.push(req.params.id);
    const result = await query(
      `UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${params.length} RETURNING id, email, full_name, role, is_active, phone, last_login, created_at, tenant_id`,
      params
    );
    res.json({ user: result.rows[0], message: 'User updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/users/:id — superadmin only
router.delete('/:id', auth, isSuperadmin, async (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'Cannot delete your own account' });
  try {
    const result = await query('DELETE FROM users WHERE id = $1 RETURNING email, full_name', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
    res.json({ message: `User ${result.rows[0].email} deleted` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/users/:id/reset-password
router.post('/:id/reset-password', auth, async (req, res) => {
  const isSelf = req.params.id === req.user.id;
  const isPriv = permissions.canManageUsers(req.user);
  if (!isSelf && !isPriv) return res.status(403).json({ error: 'Insufficient permissions' });
  const { new_password, current_password } = req.body;
  if (!new_password || new_password.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });
  try {
    const result = await query('SELECT password_hash, tenant_id FROM users WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
    // Tenant boundary check
    if (!permissions.isSuperadmin(req.user) && result.rows[0].tenant_id !== req.user.tenant_id) {
      return res.status(403).json({ error: 'Cannot modify users outside your organisation' });
    }
    if (isSelf && !isPriv) {
      if (!current_password) return res.status(400).json({ error: 'current_password is required' });
      if (!await bcrypt.compare(current_password, result.rows[0].password_hash)) return res.status(401).json({ error: 'Current password is incorrect' });
    }
    await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [await bcrypt.hash(new_password, 10), req.params.id]);
    res.json({ message: 'Password reset successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
