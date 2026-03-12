/**
 * server.js — TerzoCloud Asset Portal API
 *
 * Start:  node server.js
 * Then open: http://localhost:3000
 *
 * Environment variables (optional – set in .env):
 *   PORT       = 3000
 *   MONGO_URI  = mongodb://127.0.0.1:27017/terzocloud_assets
 *   JWT_SECRET = your-secret-key
 */

require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const path      = require('path');
const jwt       = require('jsonwebtoken');
const bcrypt    = require('bcryptjs');
const { connect, User, Asset, Log, Software, AdminUser } = require('./db');

const app       = express();
const PORT      = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'terzocloud_jwt_secret_2025';
const JWT_EXPIRES = '24h';

app.use(cors());
app.use(express.json());

// ── Serve static files (login.html, admin.html, etc.) ─────────────────────────
app.use(express.static(path.join(__dirname)));

// ── Public routes (no auth required) ──────────────────────────────────────────
app.get('/login', (req, res) =>
  res.sendFile(path.join(__dirname, 'login.html'))
);
app.get('/admin', (req, res) =>
  res.sendFile(path.join(__dirname, 'admin.html'))
);
app.get('/', (req, res) =>
  res.sendFile(path.join(__dirname, 'user-asset-portal.html'))
);

// ════════════════════════════════════════════════════════════════════════════
//  AUTH MIDDLEWARE
// ════════════════════════════════════════════════════════════════════════════

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

// Role-based permission helper
// Returns a middleware that allows the listed roles (or all if no list given)
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (roles.length && !roles.includes(req.user.role))
      return res.status(403).json({ error: 'Insufficient permissions' });
    next();
  };
}

// Shorthand permission sets
const canWrite = requireRole('super_admin', 'admin', 'it_manager');   // assets only for it_manager – refined per route below
const canWriteUsers = requireRole('super_admin', 'admin');
const canWriteSoftware = requireRole('super_admin', 'admin');
const canWriteAssets = requireRole('super_admin', 'admin', 'it_manager');
const onlySuperAdmin = requireRole('super_admin');

// ════════════════════════════════════════════════════════════════════════════
//  AUTH ROUTES  (public — no requireAuth)
// ════════════════════════════════════════════════════════════════════════════

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email and password are required' });

    const user = await AdminUser.findOne({ email: email.toLowerCase().trim() });
    if (!user)
      return res.status(401).json({ error: 'Invalid email or password' });
    if (user.status === 'Inactive')
      return res.status(403).json({ error: 'Your account is disabled. Contact a Super Admin.' });

    const match = await user.comparePassword(password);
    if (!match)
      return res.status(401).json({ error: 'Invalid email or password' });

    // Update lastLogin
    user.lastLogin = new Date();
    await user.save();

    const payload = { id: user._id.toString(), email: user.email, name: user.name, role: user.role };
    const token   = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });

    res.json({ token, user: { id: payload.id, name: user.name, email: user.email, role: user.role } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/auth/me — validate token & return current user
app.get('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const user = await AdminUser.findById(req.user.id).select('-password').lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ id: user._id.toString(), name: user.name, email: user.email, role: user.role, status: user.status });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════════════════════
//  ADMIN CONSOLE — Portal User Management  (super_admin only)
// ════════════════════════════════════════════════════════════════════════════

// GET /api/admin/users
app.get('/api/admin/users', requireAuth, onlySuperAdmin, async (req, res) => {
  try {
    const users = await AdminUser.find().select('-password').sort({ createdAt: 1 }).lean();
    res.json(users.map(u => ({ id: u._id.toString(), name: u.name, email: u.email, role: u.role, status: u.status, lastLogin: u.lastLogin, createdAt: u.createdAt })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/admin/users
app.post('/api/admin/users', requireAuth, onlySuperAdmin, async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'name, email and password are required' });
    const user = await AdminUser.create({ name, email, password, role: role || 'viewer' });
    res.status(201).json({ id: user._id.toString(), name: user.name, email: user.email, role: user.role, status: user.status });
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ error: 'Email already exists' });
    res.status(400).json({ error: e.message });
  }
});

// PUT /api/admin/users/:id
app.put('/api/admin/users/:id', requireAuth, onlySuperAdmin, async (req, res) => {
  try {
    const { name, email, role, status } = req.body;
    const user = await AdminUser.findByIdAndUpdate(
      req.params.id,
      { name, email, role, status },
      { new: true, runValidators: true }
    ).select('-password');
    if (!user) return res.status(404).json({ error: 'Portal user not found' });
    res.json({ id: user._id.toString(), name: user.name, email: user.email, role: user.role, status: user.status });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// PUT /api/admin/users/:id/reset-password  (super_admin only)
app.put('/api/admin/users/:id/reset-password', requireAuth, onlySuperAdmin, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    const user = await AdminUser.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Portal user not found' });
    user.password = password; // pre-save hook hashes it
    await user.save();
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// DELETE /api/admin/users/:id
app.delete('/api/admin/users/:id', requireAuth, onlySuperAdmin, async (req, res) => {
  try {
    if (req.params.id === req.user.id)
      return res.status(400).json({ error: 'You cannot delete your own account' });
    const user = await AdminUser.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: 'Portal user not found' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════════════════════
//  SHARED HELPERS
// ════════════════════════════════════════════════════════════════════════════

// ── Helper: normalise a Mongoose doc to a plain object with `id` ──────────────
function fmt(doc) {
  const o = doc.toObject ? doc.toObject({ virtuals: false }) : { ...doc };
  o.id = o._id.toString();
  if (o.assignedTo) o.assignedTo = o.assignedTo.toString();
  delete o._id;
  delete o.__v;
  return o;
}

// ── Logging helper ─────────────────────────────────────────────────────────────
const ACTOR = 'Praveen M. (IT Admin)';

async function writeLog(data) {
  try {
    await Log.create({ ...data, actorName: ACTOR });
  } catch (err) {
    console.error('Log write error:', err.message);
  }
}

// Build a field-level diff between two plain objects
function diffObjects(oldObj, newObj, fields) {
  const changes = [];
  for (const field of fields) {
    const o = String(oldObj[field] ?? '');
    const n = String(newObj[field] ?? '');
    if (o !== n) changes.push({ field, oldValue: o || '—', newValue: n || '—' });
  }
  return changes;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  USERS
// ═══════════════════════════════════════════════════════════════════════════════

// GET  /api/users
app.get('/api/users', requireAuth, async (req, res) => {
  try {
    const users = await User.find().sort({ first: 1 });
    res.json(users.map(fmt));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/users
app.post('/api/users', requireAuth, canWriteUsers, async (req, res) => {
  try {
    const user = await User.create(req.body);
    const u = fmt(user);
    await writeLog({
      eventType:   'user_created',
      entityType:  'user',
      entityId:    u.id,
      entityLabel: `${u.first} ${u.last}`.trim(),
      summary:     `New user created: ${u.first} ${u.last} (${u.dept}, ${u.email})`,
    });
    res.status(201).json(u);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// PUT  /api/users/:id
app.put('/api/users/:id', requireAuth, canWriteUsers, async (req, res) => {
  try {
    const oldUser = await User.findById(req.params.id).lean();
    const user = await User.findByIdAndUpdate(req.params.id, req.body, {
      new: true, runValidators: true,
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const u = fmt(user);

    const TRACKED_FIELDS = [
      'first','last','email','dept','role','location','status',
      'jobTitle','reportingManager','phone','employmentType',
    ];
    const changes = diffObjects(oldUser || {}, req.body, TRACKED_FIELDS);

    if (changes.length > 0) {
      await writeLog({
        eventType:   'user_updated',
        entityType:  'user',
        entityId:    u.id,
        entityLabel: `${u.first} ${u.last}`.trim(),
        changes,
        summary:     `User info updated: ${u.first} ${u.last} — ${changes.map(c => c.field).join(', ')} changed`,
      });
    }
    res.json(u);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// DELETE /api/users/:id
app.delete('/api/users/:id', requireAuth, canWriteUsers, async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    await Asset.updateMany(
      { assignedTo: req.params.id },
      { $set: { assignedTo: null, status: 'Available' } }
    );
    await writeLog({
      eventType:   'user_deleted',
      entityType:  'user',
      entityId:    req.params.id,
      entityLabel: `${user.first} ${user.last}`.trim(),
      summary:     `User deleted: ${user.first} ${user.last} (${user.dept}, ${user.email})`,
    });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  ASSETS
// ═══════════════════════════════════════════════════════════════════════════════

// GET  /api/assets
app.get('/api/assets', requireAuth, async (req, res) => {
  try {
    const assets = await Asset.find().sort({ csvId: 1 });
    res.json(assets.map(fmt));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/assets
app.post('/api/assets', requireAuth, canWriteAssets, async (req, res) => {
  try {
    const body = { ...req.body };
    if (!body.assignedTo) body.assignedTo = null;
    const asset = await Asset.create(body);
    const a = fmt(asset);

    if (a.assignedTo) {
      const assignedUser = await User.findById(a.assignedTo).lean();
      await writeLog({
        eventType:        'device_allocated',
        entityType:       'asset',
        entityId:         a.id,
        entityLabel:      `${a.name} (${a.csvId})`,
        deviceId:         a.csvId,
        deviceType:       a.type,
        deviceModel:      a.name,
        deviceSerial:     a.serial || '',
        assignedUserId:   a.assignedTo,
        assignedUserName: assignedUser ? `${assignedUser.first} ${assignedUser.last}` : '',
        assignedUserDept: assignedUser?.dept || '',
        summary: `${a.name} (${a.csvId}) allocated to ${assignedUser ? assignedUser.first + ' ' + assignedUser.last : 'Unknown'} [${assignedUser?.dept || ''}]`,
      });
    } else {
      await writeLog({
        eventType:   'asset_created',
        entityType:  'asset',
        entityId:    a.id,
        entityLabel: `${a.name} (${a.csvId})`,
        deviceId:    a.csvId,
        deviceType:  a.type,
        deviceModel: a.name,
        deviceSerial:a.serial || '',
        summary:     `New asset added: ${a.name} (${a.csvId}) — ${a.type}`,
      });
    }
    res.status(201).json(a);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// PUT  /api/assets/:id
app.put('/api/assets/:id', requireAuth, canWriteAssets, async (req, res) => {
  try {
    const body = { ...req.body };
    if (!body.assignedTo) body.assignedTo = null;

    const oldAsset = await Asset.findById(req.params.id).lean();
    const asset = await Asset.findByIdAndUpdate(req.params.id, body, {
      new: true, runValidators: true,
    });
    if (!asset) return res.status(404).json({ error: 'Asset not found' });
    const a = fmt(asset);

    const oldAssigned = oldAsset?.assignedTo ? oldAsset.assignedTo.toString() : null;
    const newAssigned = body.assignedTo || null;

    if (oldAssigned !== newAssigned) {
      // ── Allocation / Unassignment event ─────────────────────────────────
      if (newAssigned) {
        const assignedUser = await User.findById(newAssigned).lean();
        await writeLog({
          eventType:        'device_allocated',
          entityType:       'asset',
          entityId:         a.id,
          entityLabel:      `${a.name} (${a.csvId})`,
          deviceId:         a.csvId,
          deviceType:       a.type,
          deviceModel:      a.name,
          deviceSerial:     a.serial || '',
          assignedUserId:   newAssigned,
          assignedUserName: assignedUser ? `${assignedUser.first} ${assignedUser.last}` : '',
          assignedUserDept: assignedUser?.dept || '',
          summary: `${a.name} (${a.csvId}) allocated to ${assignedUser ? assignedUser.first + ' ' + assignedUser.last : 'Unknown'} [${assignedUser?.dept || ''}]`,
        });
      } else {
        let prevUserName = '';
        if (oldAssigned) {
          const prevUser = await User.findById(oldAssigned).lean();
          prevUserName = prevUser ? `${prevUser.first} ${prevUser.last}` : oldAssigned;
        }
        await writeLog({
          eventType:        'device_unassigned',
          entityType:       'asset',
          entityId:         a.id,
          entityLabel:      `${a.name} (${a.csvId})`,
          deviceId:         a.csvId,
          deviceType:       a.type,
          deviceModel:      a.name,
          deviceSerial:     a.serial || '',
          assignedUserName: prevUserName,
          summary: `${a.name} (${a.csvId}) unassigned from ${prevUserName}`,
        });
      }
    } else {
      // ── Regular asset edit (no assignment change) ─────────────────────────
      const TRACKED_ASSET_FIELDS = ['name','type','serial','brand','desc','status','location','vendor','notes'];
      const changes = diffObjects(oldAsset || {}, body, TRACKED_ASSET_FIELDS);
      if (changes.length > 0) {
        await writeLog({
          eventType:   'asset_updated',
          entityType:  'asset',
          entityId:    a.id,
          entityLabel: `${a.name} (${a.csvId})`,
          deviceId:    a.csvId,
          deviceType:  a.type,
          deviceModel: a.name,
          deviceSerial:a.serial || '',
          changes,
          summary: `Asset updated: ${a.name} (${a.csvId}) — ${changes.map(c => c.field).join(', ')} changed`,
        });
      }
    }

    res.json(a);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// DELETE /api/assets/:id
app.delete('/api/assets/:id', requireAuth, canWriteAssets, async (req, res) => {
  try {
    const asset = await Asset.findByIdAndDelete(req.params.id);
    if (!asset) return res.status(404).json({ error: 'Asset not found' });
    await writeLog({
      eventType:   'asset_deleted',
      entityType:  'asset',
      entityId:    req.params.id,
      entityLabel: `${asset.name} (${asset.csvId})`,
      deviceId:    asset.csvId,
      deviceType:  asset.type,
      deviceModel: asset.name,
      deviceSerial:asset.serial || '',
      summary:     `Asset deleted: ${asset.name} (${asset.csvId})`,
    });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  LOGS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/logs?type=&entityType=&search=&page=&limit=
app.get('/api/logs', requireAuth, async (req, res) => {
  try {
    const { type, entityType, search, page = 1, limit = 25 } = req.query;
    const filter = {};
    if (type)       filter.eventType  = type;
    if (entityType) filter.entityType = entityType;
    if (search) {
      const re = new RegExp(search, 'i');
      filter.$or = [
        { summary:          re },
        { entityLabel:      re },
        { assignedUserName: re },
        { deviceId:         re },
        { actorName:        re },
      ];
    }
    const skip  = (parseInt(page) - 1) * parseInt(limit);
    const total = await Log.countDocuments(filter);
    const logs  = await Log.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const formatted = logs.map(l => ({
      id:               l._id.toString(),
      eventType:        l.eventType,
      entityType:       l.entityType,
      entityId:         l.entityId,
      entityLabel:      l.entityLabel,
      deviceId:         l.deviceId,
      deviceType:       l.deviceType,
      deviceModel:      l.deviceModel,
      deviceSerial:     l.deviceSerial,
      assignedUserId:   l.assignedUserId,
      assignedUserName: l.assignedUserName,
      assignedUserDept: l.assignedUserDept,
      changes:          l.changes || [],
      remarks:          l.remarks,
      actorName:        l.actorName,
      summary:          l.summary,
      createdAt:        l.createdAt,
    }));

    res.json({ total, page: parseInt(page), limit: parseInt(limit), logs: formatted });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  SOFTWARE INVENTORY
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/software
app.get('/api/software', requireAuth, async (req, res) => {
  try {
    const list = await Software.find().sort({ csvId: 1 });
    res.json(list.map(s => { const o = s.toObject(); o.id = o._id.toString(); delete o._id; delete o.__v; return o; }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/software/budget  — stats for dashboard
app.get('/api/software/budget', requireAuth, async (req, res) => {
  try {
    const all = await Software.find().lean();
    // Helper: total cost for a software entry including all active add-on services
    const svcCost = x => ((x.services || []).filter(s => s.status !== 'Inactive').reduce((ss, sv) => ss + (sv.annualCost || 0), 0));
    const totalCost = x => (x.annualCost || 0) + svcCost(x);

    const totalSpend   = all.reduce((s, x) => s + totalCost(x), 0);
    const saasSpend    = all.filter(x => x.deploymentType === 'SAAS').reduce((s, x) => s + totalCost(x), 0);
    const freeCount    = all.filter(x => totalCost(x) === 0).length;
    const paidCount    = all.filter(x => totalCost(x) > 0).length;
    const totalLic     = all.reduce((s, x) => s + (x.purchasedLicenses || 0), 0);
    const usedLic      = all.reduce((s, x) => s + (x.usedLicenses || 0), 0);
    const topApps      = [...all].sort((a, b) => totalCost(b) - totalCost(a)).slice(0, 5)
      .map(x => ({ csvId: x.csvId, name: x.name, annualCost: totalCost(x), baseCost: x.annualCost, serviceCount: (x.services||[]).length, deploymentType: x.deploymentType, department: x.department }));
    const byType       = {};
    all.forEach(x => { const t = x.deploymentType; byType[t] = (byType[t] || 0) + totalCost(x); });
    res.json({ totalSpend, saasSpend, freeCount, paidCount, totalApps: all.length, totalLic, usedLic, topApps, byType });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/software
app.post('/api/software', requireAuth, canWriteSoftware, async (req, res) => {
  try {
    const sw = await Software.create(req.body);
    const o = sw.toObject(); o.id = o._id.toString(); delete o._id; delete o.__v;
    await writeLog({ eventType: 'asset_created', entityType: 'asset', entityId: o.id, entityLabel: o.name, summary: `Software added: ${o.name} (${o.csvId})` });
    res.status(201).json(o);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// PUT /api/software/:id
app.put('/api/software/:id', requireAuth, canWriteSoftware, async (req, res) => {
  try {
    const sw = await Software.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!sw) return res.status(404).json({ error: 'Software not found' });
    const o = sw.toObject(); o.id = o._id.toString(); delete o._id; delete o.__v;
    res.json(o);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// DELETE /api/software/:id
app.delete('/api/software/:id', requireAuth, canWriteSoftware, async (req, res) => {
  try {
    const sw = await Software.findByIdAndDelete(req.params.id);
    if (!sw) return res.status(404).json({ error: 'Software not found' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Software seed data (auto-seeds on first run) ──────────────────────────────
const SOFTWARE_SEED = [
  { csvId:'A-01', name:'Zoom', owner:'Brandon Card', admins:'Praveen M', billedTo:'Eric Pritchett', deploymentType:'SAAS', department:'Management', purpose:'Communication', subscriptionPlan:'Zoom Workspace Business Plus', renewalPeriod:'Annual', annualCost:12098, licensePricePerUserMonth:25, purchasedLicenses:37, usedLicenses:46, siteUSA:true, siteCAN:true, siteIND:true, costUSA:6539, costCAN:3924, costIND:1635 },
  { csvId:'A-02', name:'Adobe Acrobat', owner:'Praveen M', admins:'Praveen M', billedTo:'Eric Pritchett', deploymentType:'SAAS', department:'HR & Legal', purpose:'PDF Editor', subscriptionPlan:'Business Plan', renewalPeriod:'Monthly', annualCost:1360.20, licensePricePerUserMonth:22.67, purchasedLicenses:5, usedLicenses:6, siteUSA:true, siteCAN:false, siteIND:true, costUSA:816, costCAN:0, costIND:544 },
  { csvId:'A-03', name:'Asana', owner:'Brandon Card', admins:'Praveen M', billedTo:'Eric Pritchett', deploymentType:'SAAS', department:'Customer Success & AI Service', purpose:'Project Management', subscriptionPlan:'Business Starter Plan', renewalPeriod:'Annual', annualCost:6540, licensePricePerUserMonth:10.90, purchasedLicenses:50, usedLicenses:42, siteUSA:true, siteCAN:true, siteIND:true, costUSA:2861, costCAN:1635, costIND:2044 },
  { csvId:'A-04', name:'Jira (Atlassian)', owner:'Brandon Card', admins:'Praveen M / Mohanraja / Vasanth', billedTo:'Eric Pritchett', deploymentType:'SAAS', department:'Engineering', purpose:'ITSM & Ticketing', subscriptionPlan:'', renewalPeriod:'Monthly', annualCost:28200, licensePricePerUserMonth:15, purchasedLicenses:48, usedLicenses:49, siteUSA:true, siteCAN:true, siteIND:true, costUSA:6600, costCAN:3000, costIND:18600 },
  { csvId:'A-05', name:'GitHub (Microsoft)', admins:'Vasanth', billedTo:'Eric Pritchett', deploymentType:'SAAS', department:'Engineering', purpose:'Version Control', subscriptionPlan:'', renewalPeriod:'Monthly', annualCost:1584, licensePricePerUserMonth:4, purchasedLicenses:34, usedLicenses:29, siteUSA:true, siteCAN:false, siteIND:true, costUSA:170, costCAN:0, costIND:1414 },
  { csvId:'A-06', name:'Google Workspace', owner:'Brandon Card', admins:'Praveen M', billedTo:'Eric Pritchett', deploymentType:'SAAS', department:'Management', purpose:'Gmail & Productivity Suite', subscriptionPlan:'Enterprise Standard', renewalPeriod:'Monthly', annualCost:36240, licensePricePerUserMonth:20, purchasedLicenses:154, usedLicenses:154, siteUSA:true, siteCAN:true, siteIND:true, costUSA:13030, costCAN:7329, costIND:15880 },
  { csvId:'A-07', name:'HubSpot', owner:'Brandon Card', admins:'Brandon Card', billedTo:'Eric Pritchett', deploymentType:'SAAS', department:'Sales', purpose:'CRM', subscriptionPlan:'', renewalPeriod:'Annual', annualCost:18370, purchasedLicenses:23, usedLicenses:19, siteUSA:true, siteCAN:false, siteIND:true, costUSA:14503, costCAN:0, costIND:3867 },
  { csvId:'A-08', name:'IntelliJ IDEA (JetBrains)', owner:'Mohanraja', admins:'Praveen M / Mohanraja', billedTo:'Eric Pritchett', deploymentType:'On-premises', department:'Engineering', purpose:'Coding IDE', subscriptionPlan:'IntelliJ Ultimate', renewalPeriod:'Annual', annualCost:8292.90, licensePricePerUserMonth:17.10, purchasedLicenses:23, usedLicenses:19, siteUSA:false, siteCAN:false, siteIND:true, costUSA:0, costCAN:0, costIND:8293 },
  { csvId:'A-09', name:'Loom', owner:'Brandon Card', admins:'Praveen M / Ragav', billedTo:'Eric Pritchett', deploymentType:'SAAS', department:'Sales & Customer Success', purpose:'Screen Recording & Presentations', subscriptionPlan:'Loom Business', renewalPeriod:'Monthly', annualCost:1728, licensePricePerUserMonth:8, purchasedLicenses:18, usedLicenses:18, siteUSA:true, siteCAN:false, siteIND:true, costUSA:1152, costCAN:0, costIND:576 },
  { csvId:'A-10', name:'Microsoft 365', owner:'Brandon Card', admins:'Praveen M', billedTo:'Eric Pritchett', deploymentType:'SAAS', department:'Management', purpose:'Office Suite', subscriptionPlan:'Business Premium', renewalPeriod:'Annual', annualCost:4488, licensePricePerUserMonth:22, purchasedLicenses:25, usedLicenses:26, siteUSA:true, siteCAN:false, siteIND:true, costUSA:3052, costCAN:0, costIND:1436 },
  { csvId:'A-11', name:'Slack', owner:'Brandon Card', admins:'Praveen M', billedTo:'Eric Pritchett', deploymentType:'SAAS', department:'Management', purpose:'Team Communication', subscriptionPlan:'Slack Business+', renewalPeriod:'Annual', annualCost:16020, licensePricePerUserMonth:15, purchasedLicenses:89, usedLicenses:92, siteUSA:true, siteCAN:true, siteIND:true, costUSA:5760, costCAN:3240, costIND:7020 },
  { csvId:'A-12', name:'Mosyle MDM', owner:'Praveen M', admins:'Praveen M', billedTo:'', deploymentType:'Freeware', department:'IT', purpose:'Device Management', subscriptionPlan:'Free', renewalPeriod:'Freeware', annualCost:0, purchasedLicenses:30, usedLicenses:25, siteUSA:false, siteCAN:false, siteIND:true, costUSA:0, costCAN:0, costIND:0 },
  { csvId:'A-13', name:'OpenVPN', owner:'Praveen M', admins:'Praveen M', billedTo:'Eric Pritchett', deploymentType:'SAAS', department:'Engineering', purpose:'VPN / Private Network', subscriptionPlan:'', renewalPeriod:'Annual', annualCost:1680, licensePricePerUserMonth:6, purchasedLicenses:20, usedLicenses:20, siteUSA:true, siteCAN:true, siteIND:true, costUSA:84, costCAN:84, costIND:1512 },
  { csvId:'A-14', name:'Canva', owner:'Brandon Card', admins:'Praveen M', billedTo:'Eric Pritchett', deploymentType:'SAAS', department:'Management', purpose:'Design & Presentations', subscriptionPlan:'Canva Teams', renewalPeriod:'Monthly', annualCost:1981, licensePricePerUserMonth:5.16, purchasedLicenses:32, usedLicenses:32, siteUSA:true, siteCAN:true, siteIND:true, costUSA:1424, costCAN:186, costIND:371 },
  { csvId:'A-15', name:'Postman', deploymentType:'Freeware', department:'Engineering', purpose:'API Testing', subscriptionPlan:'Freeware', renewalPeriod:'Freeware', annualCost:0, siteUSA:true, siteCAN:false, siteIND:true },
  { csvId:'A-16', name:'Freshworks', owner:'Gowtham Manohar', admins:'Harish', billedTo:'Eric Pritchett', deploymentType:'SAAS', department:'Customer Support / HR', purpose:'Employee Onboarding & Offboarding', subscriptionPlan:'', renewalPeriod:'Annual', annualCost:3117, licensePricePerUserMonth:1039, purchasedLicenses:3, usedLicenses:3, siteUSA:false, siteCAN:false, siteIND:true, costUSA:0, costCAN:0, costIND:3117 },
  { csvId:'A-17', name:'Windsurf', owner:'Vasanth', admins:'Vasanth', billedTo:'Eric Pritchett', deploymentType:'On-premises', department:'Engineering', purpose:'Coding IDE', subscriptionPlan:'Teams Plan', renewalPeriod:'Monthly', annualCost:3960, licensePricePerUserMonth:30, purchasedLicenses:11, usedLicenses:12, siteUSA:false, siteCAN:false, siteIND:true, costUSA:0, costCAN:0, costIND:3960 },
  { csvId:'A-18', name:'Plaid', owner:'Mohanraja', admins:'Mohanraja', billedTo:'Eric Pritchett', deploymentType:'SAAS', department:'Engineering', purpose:'Banking API Integration', subscriptionPlan:'Pay-as-you-go', renewalPeriod:'Monthly', annualCost:0, purchasedLicenses:3, usedLicenses:3, siteUSA:true, siteCAN:false, siteIND:true },
  { csvId:'A-19', name:'ProductBoard', owner:'Brad Grabowski', admins:'Himalaya / Brad', billedTo:'Eric Pritchett', deploymentType:'SAAS', department:'Product', purpose:'Product Management & Roadmapping', subscriptionPlan:'Pro Plan', renewalPeriod:'Annual', annualCost:1416, licensePricePerUserMonth:59, purchasedLicenses:2, usedLicenses:4, siteUSA:true, siteCAN:false, siteIND:true, costUSA:708, costCAN:0, costIND:708 },
  { csvId:'A-20', name:'DocuSign', owner:'Brandon Card', admins:'Gowtham Manohar', billedTo:'Eric Pritchett', deploymentType:'SAAS', department:'HR / Legal', purpose:'Digital Signatures', subscriptionPlan:'Business Pro – Envelope Edition', renewalPeriod:'Annual', annualCost:7237.76, purchasedLicenses:9, usedLicenses:9, siteUSA:true, siteCAN:false, siteIND:true, costUSA:4825, costCAN:0, costIND:2413 },
  { csvId:'A-21', name:'Vercel', owner:'Himalaya', admins:'Himalaya', billedTo:'Eric Pritchett', deploymentType:'SAAS', department:'Product', purpose:'Frontend Deployment', subscriptionPlan:'Pro Plan', renewalPeriod:'Monthly', annualCost:240, licensePricePerUserMonth:20, purchasedLicenses:1, usedLicenses:1, siteUSA:false, siteCAN:false, siteIND:true, costUSA:0, costCAN:0, costIND:240 },
  { csvId:'A-22', name:'Twilio SendGrid', owner:'Vasanth', admins:'Vasanth', billedTo:'Eric Pritchett', deploymentType:'SAAS', department:'Engineering', purpose:'Transactional Email Service', subscriptionPlan:'Pro Plan (100k Mails)', renewalPeriod:'Monthly', annualCost:1988.04, licensePricePerUserMonth:165.57, purchasedLicenses:4, usedLicenses:4, siteUSA:false, siteCAN:false, siteIND:true, costUSA:0, costCAN:0, costIND:1988 },
  { csvId:'A-23', name:'Datadog', owner:'Vasanth', admins:'Vasanth / Ajay', billedTo:'Eric Pritchett', deploymentType:'SAAS', department:'Engineering', purpose:'Monitoring & Observability', subscriptionPlan:'Pay-as-you-go', renewalPeriod:'Monthly', annualCost:56100, purchasedLicenses:35, usedLicenses:35, siteUSA:true, siteCAN:true, siteIND:true, costUSA:8014, costCAN:3206, costIND:44880 },
  { csvId:'A-24', name:'Gong', owner:'Brandon Card', admins:'Praveen / Brody', billedTo:'', deploymentType:'SAAS', department:'Sales', purpose:'Sales Call Recording & Analytics', subscriptionPlan:'', renewalPeriod:'Annual', annualCost:8250, purchasedLicenses:6, usedLicenses:7, siteUSA:true, siteCAN:true, siteIND:false, costUSA:7219, costCAN:1031, costIND:0 },
  { csvId:'A-25', name:'Figma', owner:'Brad Grabowski', admins:'Praveen / Brad Grabowski', billedTo:'Eric Pritchett', deploymentType:'SAAS', department:'Engineering', purpose:'UI/UX Design', subscriptionPlan:'', renewalPeriod:'Annual', annualCost:500, purchasedLicenses:0, usedLicenses:0, siteUSA:true, siteCAN:false, siteIND:true, costUSA:500, costCAN:0, costIND:0 },
  { csvId:'A-26', name:'ChatGPT (OpenAI)', owner:'Brandon Card', admins:'Praveen / Brandon', billedTo:'Eric Pritchett', deploymentType:'SAAS', department:'Management / AI Service', purpose:'AI Assistant', subscriptionPlan:'Teams Plan', renewalPeriod:'Monthly', annualCost:8280, licensePricePerUserMonth:30, purchasedLicenses:26, usedLicenses:28, siteUSA:true, siteCAN:true, siteIND:true, costUSA:4458, costCAN:2548, costIND:1274 },
  { csvId:'A-27', name:'Jenkins', owner:'Vasanth', admins:'Praveen M / Vasanth / Ajay', billedTo:'', deploymentType:'Open Source', department:'Engineering', purpose:'CI/CD Build Pipeline', subscriptionPlan:'Open Source', renewalPeriod:'Freeware', annualCost:0, purchasedLicenses:20, usedLicenses:0, siteUSA:false, siteCAN:true, siteIND:true },
  { csvId:'A-28', name:'Orum', owner:'Brody', admins:'Brody', billedTo:'Eric Pritchett', deploymentType:'SAAS', department:'Sales', purpose:'Sales Calling Platform', subscriptionPlan:'', renewalPeriod:'Monthly', annualCost:3000, licensePricePerUserMonth:250, purchasedLicenses:1, usedLicenses:1, siteUSA:true, siteCAN:false, siteIND:false, costUSA:3000, costCAN:0, costIND:0 },
  { csvId:'A-29', name:'Apple Business Manager', owner:'Praveen M', admins:'Praveen M', billedTo:'', deploymentType:'Freeware', department:'IT', purpose:'Apple ID & Device Management', subscriptionPlan:'Freeware', renewalPeriod:'Freeware', annualCost:0, siteUSA:true, siteCAN:true, siteIND:true },
  { csvId:'A-30', name:'ChatPRD', owner:'Himalaya', admins:'Himalaya', billedTo:'Himalaya', deploymentType:'SAAS', department:'Product', purpose:'AI Product Requirements', subscriptionPlan:'Pro Plan', renewalPeriod:'Annual', annualCost:179, licensePricePerUserMonth:14.90, purchasedLicenses:1, usedLicenses:1, siteUSA:false, siteCAN:false, siteIND:true, costUSA:0, costCAN:0, costIND:179 },
  { csvId:'A-31', name:'AWS', owner:'Pradeep', admins:'Vasanth / Pradeep', billedTo:'Eric Pritchett', deploymentType:'SAAS', department:'Engineering', purpose:'Cloud Infrastructure', subscriptionPlan:'Pay-as-you-go', renewalPeriod:'Monthly', annualCost:0, purchasedLicenses:0, usedLicenses:25, siteUSA:false, siteCAN:false, siteIND:true },
  { csvId:'A-32', name:'Miro', owner:'Himalaya', admins:'Praveen M / Himalaya', billedTo:'Eric Pritchett', deploymentType:'SAAS', department:'Product', purpose:'Digital Whiteboard & Workflow', subscriptionPlan:'Starter Plan', renewalPeriod:'Monthly', annualCost:96, licensePricePerUserMonth:8, purchasedLicenses:1, usedLicenses:1, siteUSA:false, siteCAN:false, siteIND:true, costUSA:0, costCAN:0, costIND:96 },
  { csvId:'A-33', name:'Claude (Anthropic)', owner:'Luis', admins:'Luis', billedTo:'Eric Pritchett', deploymentType:'SAAS', department:'Engineering', purpose:'AI Assistant', subscriptionPlan:'Teams Plan', renewalPeriod:'Monthly', annualCost:0, purchasedLicenses:45, usedLicenses:45, siteUSA:false, siteCAN:false, siteIND:false },
];

async function seedSoftware() {
  const count = await Software.countDocuments();
  if (count > 0) return;
  await Software.insertMany(SOFTWARE_SEED);
  console.log(`✅  Software seeded: ${SOFTWARE_SEED.length} apps`);
}

// ── Seed default super admin ───────────────────────────────────────────────────
async function seedAdminUser() {
  const count = await AdminUser.countDocuments();
  if (count > 0) return;
  await AdminUser.create({
    name:     'Praveen M.',
    email:    'admin@terzocloud.com',
    password: 'Admin@123',   // hashed by pre-save hook
    role:     'super_admin',
    status:   'Active',
  });
  console.log('✅  Default super admin seeded → admin@terzocloud.com / Admin@123');
}

// ── Start ─────────────────────────────────────────────────────────────────────
connect().then(async () => {
  await seedSoftware();
  await seedAdminUser();
  app.listen(PORT, () =>
    console.log(`🚀  Portal running → http://localhost:${PORT}`)
  );
});
