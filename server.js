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
const mongoose = require('mongoose');
const { connect, User, Asset } = require('./db');

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
    res.status(201).json(fmt(user));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// PUT  /api/users/:id
app.put('/api/users/:id', async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, req.body, {
      new: true, runValidators: true,
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(fmt(user));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// DELETE /api/users/:id
app.delete('/api/users/:id', async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    // Unassign any assets that belonged to this user
    await Asset.updateMany(
      { assignedTo: req.params.id },
      { $set: { assignedTo: null, status: 'Available' } }
    );
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
    res.status(201).json(fmt(asset));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// PUT  /api/assets/:id
app.put('/api/assets/:id', async (req, res) => {
  try {
    const body = { ...req.body };
    if (!body.assignedTo) body.assignedTo = null;
    const asset = await Asset.findByIdAndUpdate(req.params.id, body, {
      new: true, runValidators: true,
    });
    if (!asset) return res.status(404).json({ error: 'Asset not found' });
    res.json(fmt(asset));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// DELETE /api/assets/:id
app.delete('/api/assets/:id', async (req, res) => {
  try {
    const asset = await Asset.findByIdAndDelete(req.params.id);
    if (!asset) return res.status(404).json({ error: 'Asset not found' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Start ─────────────────────────────────────────────────────────────────────
connect().then(() => {
  app.listen(PORT, () =>
    console.log(`🚀  Portal running → http://localhost:${PORT}`)
  );
});
