/**
 * server.js — TerzoCloud Asset Portal API
 *
 * Start:  node server.js
 * Then open: http://localhost:3000
 *
 * Environment variables (optional – set in .env):
 *   PORT      = 3000
 *   MONGO_URI = mongodb://127.0.0.1:27017/terzocloud_assets
 */

require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const path     = require('path');
const { connect, User, Asset, Log } = require('./db');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ── Serve the portal HTML ──────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname)));
app.get('/', (req, res) =>
  res.sendFile(path.join(__dirname, 'user-asset-portal.html'))
);

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
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find().sort({ first: 1 });
    res.json(users.map(fmt));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/users
app.post('/api/users', async (req, res) => {
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
app.put('/api/users/:id', async (req, res) => {
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
app.delete('/api/users/:id', async (req, res) => {
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
app.get('/api/assets', async (req, res) => {
  try {
    const assets = await Asset.find().sort({ csvId: 1 });
    res.json(assets.map(fmt));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/assets
app.post('/api/assets', async (req, res) => {
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
app.put('/api/assets/:id', async (req, res) => {
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
app.delete('/api/assets/:id', async (req, res) => {
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
app.get('/api/logs', async (req, res) => {
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

// ── Start ─────────────────────────────────────────────────────────────────────
connect().then(() => {
  app.listen(PORT, () =>
    console.log(`🚀  Portal running → http://localhost:${PORT}`)
  );
});
