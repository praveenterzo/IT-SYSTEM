/**
 * middleware/auth.js — JWT authentication and role-based access control
 *
 * Exports:
 *   requireAuth       — verifies Bearer JWT, sets req.user
 *   requireRole(...)  — checks req.user.role against allowed list
 *   canWrite          — super_admin | admin | it_manager
 *   canWriteUsers     — super_admin | admin
 *   canWriteSoftware  — super_admin | admin
 *   canWriteAssets    — super_admin | admin | it_manager
 *   onlySuperAdmin    — super_admin only
 */
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');

function requireAuth(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (roles.length && !roles.includes(req.user.role))
      return res.status(403).json({ error: 'Insufficient permissions' });
    next();
  };
}

const canWrite         = requireRole('super_admin', 'admin', 'it_manager');
const canWriteUsers    = requireRole('super_admin', 'admin');
const canWriteSoftware = requireRole('super_admin', 'admin');
const canWriteAssets   = requireRole('super_admin', 'admin', 'it_manager');
const onlySuperAdmin   = requireRole('super_admin');

module.exports = {
  requireAuth,
  requireRole,
  canWrite,
  canWriteUsers,
  canWriteSoftware,
  canWriteAssets,
  onlySuperAdmin,
};
