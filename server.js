/**
 * server.js — TerzoCloud Asset Portal  (modular monolith entry point)
 *
 * Start:  node server.js
 * Then open: http://localhost:3000
 *
 * Environment variables (optional — set in .env or export):
 *   PORT       = 3000
 *   MONGO_URI  = mongodb://127.0.0.1:27017/terzocloud_assets
 *   JWT_SECRET = your-secret-key
 *   LOG_ACTOR  = Praveen M. (IT Admin)
 */

const express = require('express');
const cors    = require('cors');
const path    = require('path');

const { connect }                     = require('./db');
const { PORT }                        = require('./config');
const { seedSoftware, seedAdminUser } = require('./seed/software.seed');

// ── Route modules ──────────────────────────────────────────────────────────────
const authRoutes             = require('./routes/auth.routes');
const userRoutes             = require('./routes/users.routes');
const assetRoutes            = require('./routes/assets.routes');
const softwareRoutes         = require('./routes/software.routes');
const logRoutes              = require('./routes/logs.routes');
const scimRoutes             = require('./routes/scim.routes');
const adminUserRoutes        = require('./routes/admin/users.routes');
const adminIntegrationRoutes = require('./routes/admin/integrations.routes');
const adminScimRoutes        = require('./routes/admin/scim.routes');
const adminConnectorRoutes   = require('./routes/admin/connectors.routes');

// ── App setup ──────────────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

// ── Static files ───────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname)));

// ── Public page routes ─────────────────────────────────────────────────────────
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));
app.get('/',      (req, res) => res.sendFile(path.join(__dirname, 'user-asset-portal.html')));

// ── API routes ─────────────────────────────────────────────────────────────────
app.use('/api/auth',               authRoutes);
app.use('/api/users',              userRoutes);
app.use('/api/assets',             assetRoutes);
app.use('/api/software',           softwareRoutes);
app.use('/api/logs',               logRoutes);
app.use('/api/admin/users',        adminUserRoutes);
app.use('/api/admin/integrations', adminIntegrationRoutes);
app.use('/api/admin/scim',         adminScimRoutes);
app.use('/api/admin/connectors',   adminConnectorRoutes);

// ── SCIM 2.0 — force application/scim+json content-type for all /scim routes ──
app.use('/scim/v2', (req, res, next) => {
  res.setHeader('Content-Type', 'application/scim+json');
  next();
}, scimRoutes);

// ── Start ──────────────────────────────────────────────────────────────────────
connect().then(async () => {
  await seedSoftware();
  await seedAdminUser();
  app.listen(PORT, () =>
    console.log(`🚀  Portal running → http://localhost:${PORT}`)
  );
});
