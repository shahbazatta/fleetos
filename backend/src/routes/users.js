const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const { auth, requireRole } = require('../middleware/auth');

// Role hierarchy: superadmin > admin > operator > viewer
const ROLES = ['viewer', 'operator', 'admin', 'superadmin'];

function roleRank(role) {
  return ROLES.indexOf(role ?? 'viewer');
}

// ── GET /api/users ─────────────────────────────────────────────────────────
// superadmin sees all users; admin sees everyone except superadmins
router.get('/', auth, requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    const isSuperadmin = req.user.role === 'superadmin';
    const result = await query(`
      SELECT id, email, full_name, role, is_active,
             last_login, created_at, phone, avatar_url
      FROM users
      ${isSuperadmin ? '' : "WHERE role != 'superadmin'"}
      ORDER BY
        CASE role
          WHEN 'superadmin' THEN 0
          WHEN 'admin'      THEN 1
          WHEN 'operator'   THEN 2
          WHEN 'viewer'     THEN 3
        END,
        full_name
    `);
    res.json({ users: result.rows, total: result.rowCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/users/:id ─────────────────────────────────────────────────────
router.get('/:id', auth, requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    const result = await query(
      `SELECT id, email, full_name, role, is_active, last_login, created_at, phone
       FROM users WHERE id = $1`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });

    // Non-superadmins cannot view superadmin accounts
    if (result.rows[0].role === 'superadmin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    res.json({ user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/users ────────────────────────────────────────────────────────
// Only superadmin can create admins/superadmins; admin can create operators/viewers
router.post('/', auth, requireRole('admin', 'superadmin'), async (req, res) => {
  const { email, password, full_name, role = 'operator', phone } = req.body;

  // Validation
  if (!email || !password || !full_name) {
    return res.status(400).json({ error: 'email, password and full_name are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  if (!ROLES.includes(role)) {
    return res.status(400).json({ error: `Invalid role. Must be one of: ${ROLES.join(', ')}` });
  }

  // Role creation rules
  if (role === 'superadmin' && req.user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Only superadmins can create superadmin accounts' });
  }
  if (role === 'admin' && req.user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Only superadmins can create admin accounts' });
  }

  try {
    // Check email unique
    const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (existing.rows.length) {
      return res.status(409).json({ error: 'A user with this email already exists' });
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await query(
      `INSERT INTO users (email, password_hash, full_name, role, phone, is_active)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING id, email, full_name, role, is_active, created_at, phone`,
      [email.toLowerCase().trim(), hash, full_name.trim(), role, phone || null]
    );

    res.status(201).json({ user: result.rows[0], message: 'User created successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/users/:id ───────────────────────────────────────────────────
router.patch('/:id', auth, requireRole('admin', 'superadmin'), async (req, res) => {
  const { full_name, role, is_active, phone, password } = req.body;

  try {
    // Fetch target user
    const existing = await query('SELECT * FROM users WHERE id = $1', [req.params.id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'User not found' });

    const target = existing.rows[0];

    // Non-superadmins cannot edit superadmin accounts
    if (target.role === 'superadmin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Cannot modify a superadmin account' });
    }
    // Cannot self-demote
    if (req.params.id === req.user.id && role && role !== req.user.role) {
      return res.status(400).json({ error: 'You cannot change your own role' });
    }
    // Role escalation rules
    if (role && roleRank(role) >= roleRank('admin') && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Only superadmins can assign admin or superadmin roles' });
    }

    const updates = [];
    const params  = [];

    if (full_name !== undefined) { params.push(full_name.trim()); updates.push(`full_name = $${params.length}`); }
    if (role      !== undefined) { params.push(role);             updates.push(`role = $${params.length}`); }
    if (is_active !== undefined) { params.push(is_active);        updates.push(`is_active = $${params.length}`); }
    if (phone     !== undefined) { params.push(phone || null);    updates.push(`phone = $${params.length}`); }
    if (password) {
      if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
      const hash = await bcrypt.hash(password, 10);
      params.push(hash);
      updates.push(`password_hash = $${params.length}`);
    }

    if (!updates.length) return res.status(400).json({ error: 'No fields to update' });

    params.push(req.params.id);
    const result = await query(
      `UPDATE users SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${params.length}
       RETURNING id, email, full_name, role, is_active, phone, last_login, created_at`,
      params
    );

    res.json({ user: result.rows[0], message: 'User updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/users/:id ──────────────────────────────────────────────────
router.delete('/:id', auth, requireRole('superadmin'), async (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: 'You cannot delete your own account' });
  }
  try {
    const result = await query(
      'DELETE FROM users WHERE id = $1 RETURNING id, email, full_name',
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
    res.json({ message: `User ${result.rows[0].email} deleted`, user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/users/:id/reset-password ────────────────────────────────────
// Superadmin can reset anyone's password; users can reset their own
router.post('/:id/reset-password', auth, async (req, res) => {
  const isSelf      = req.params.id === req.user.id;
  const isPrivileged = ['admin', 'superadmin'].includes(req.user.role);

  if (!isSelf && !isPrivileged) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  const { new_password, current_password } = req.body;
  if (!new_password || new_password.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }

  try {
    const result = await query('SELECT password_hash FROM users WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });

    // If resetting own password, require current password verification
    if (isSelf && !isPrivileged) {
      if (!current_password) return res.status(400).json({ error: 'current_password is required' });
      const valid = await bcrypt.compare(current_password, result.rows[0].password_hash);
      if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hash = await bcrypt.hash(new_password, 10);
    await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hash, req.params.id]);
    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/users/me/profile ──────────────────────────────────────────────
router.get('/me/profile', auth, async (req, res) => {
  try {
    const result = await query(
      'SELECT id, email, full_name, role, is_active, last_login, created_at, phone FROM users WHERE id = $1',
      [req.user.id]
    );
    res.json({ user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
