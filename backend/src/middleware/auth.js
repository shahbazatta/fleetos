const jwt = require('jsonwebtoken');

// ── Auth middleware ─────────────────────────────────────────────────────────
const auth = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const token = header.split(' ')[1];
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret');
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// ── Role guard ──────────────────────────────────────────────────────────────
const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  next();
};

// ── Tenant scope injection ──────────────────────────────────────────────────
// Attaches req.tenantId scoped from JWT.
// Superadmins may pass ?tenant_id= or x-tenant-id header to target a tenant.
const tenantScope = (req, res, next) => {
  if (req.user.role === 'superadmin') {
    req.tenantId = req.query.tenant_id || req.headers['x-tenant-id'] || null;
  } else {
    if (!req.user.tenant_id) {
      return res.status(403).json({ error: 'User is not assigned to a tenant' });
    }
    req.tenantId = req.user.tenant_id;
  }
  next();
};

// ── Permission helpers ──────────────────────────────────────────────────────
const permissions = {
  canRead:        (u) => ['viewer', 'operator', 'admin', 'superadmin'].includes(u?.role),
  canAssign:      (u) => ['operator', 'admin', 'superadmin'].includes(u?.role),
  canManageFleet: (u) => ['operator', 'admin', 'superadmin'].includes(u?.role),
  canManageUsers: (u) => ['admin', 'superadmin'].includes(u?.role),
  isSuperadmin:   (u) => u?.role === 'superadmin',
};

const canRead        = (req, res, next) => permissions.canRead(req.user)        ? next() : res.status(403).json({ error: 'Read access required' });
const canAssign      = (req, res, next) => permissions.canAssign(req.user)      ? next() : res.status(403).json({ error: 'Operator role required to assign fleet' });
const canManageFleet = (req, res, next) => permissions.canManageFleet(req.user) ? next() : res.status(403).json({ error: 'Admin role required to manage fleet' });
const canManageUsers = (req, res, next) => permissions.canManageUsers(req.user) ? next() : res.status(403).json({ error: 'Admin role required to manage users' });
const isSuperadmin   = (req, res, next) => permissions.isSuperadmin(req.user)   ? next() : res.status(403).json({ error: 'Superadmin access required' });

module.exports = { auth, requireRole, tenantScope, permissions, canRead, canAssign, canManageFleet, canManageUsers, isSuperadmin };
