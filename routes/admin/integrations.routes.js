/**
 * routes/admin/integrations.routes.js — Integration Settings (super_admin only)
 *
 * GET /api/admin/integrations
 * PUT /api/admin/integrations
 */
const router = require('express').Router();
const { IntegrationSettings } = require('../../db');
const { requireAuth, onlySuperAdmin } = require('../../middleware/auth');

// ── GET /api/admin/integrations ────────────────────────────────────────────────
router.get('/', requireAuth, onlySuperAdmin, async (req, res) => {
  try {
    const s = await IntegrationSettings.findOne({ provider: 'google' });
    res.json({
      google: {
        enabled:         s ? s.enabled : false,
        clientId:        s ? s.clientId : '',
        clientSecret:    s && s.clientSecret ? '••••••••' : '',
        hasClientSecret: !!(s && s.clientSecret),
        allowedDomain:   s ? s.allowedDomain : '',
      },
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PUT /api/admin/integrations ────────────────────────────────────────────────
router.put('/', requireAuth, onlySuperAdmin, async (req, res) => {
  try {
    const g = req.body.google || {};
    const update = {
      enabled:       !!g.enabled,
      clientId:      (g.clientId      || '').trim(),
      allowedDomain: (g.allowedDomain || '').trim().toLowerCase(),
    };
    // Only overwrite clientSecret if a real value (not the masked placeholder) is supplied
    if (g.clientSecret && g.clientSecret !== '••••••••') {
      update.clientSecret = g.clientSecret.trim();
    }
    await IntegrationSettings.findOneAndUpdate(
      { provider: 'google' },
      { $set: update },
      { upsert: true, new: true }
    );
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
