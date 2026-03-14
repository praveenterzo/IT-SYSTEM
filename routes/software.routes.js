/**
 * routes/software.routes.js — Software Inventory
 *
 * GET    /api/software
 * GET    /api/software/budget
 * POST   /api/software
 * PUT    /api/software/:id
 * DELETE /api/software/:id
 */
const router = require('express').Router();
const { Software } = require('../db');
const { requireAuth, canWriteSoftware } = require('../middleware/auth');
const { writeLog } = require('../services/log.service');

// Helper: total cost for a software entry including active add-on services
const svcCost   = x => ((x.services || []).filter(s => s.status !== 'Inactive').reduce((ss, sv) => ss + (sv.annualCost || 0), 0));
const totalCost = x => (x.annualCost || 0) + svcCost(x);

// Normalise a Software doc to a plain object
function fmtSw(s) {
  const o = s.toObject ? s.toObject() : { ...s };
  o.id = o._id.toString();
  delete o._id;
  delete o.__v;
  return o;
}

// ── GET /api/software ──────────────────────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  try {
    const list = await Software.find().sort({ csvId: 1 });
    res.json(list.map(fmtSw));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/software/budget — dashboard stats ─────────────────────────────────
router.get('/budget', requireAuth, async (req, res) => {
  try {
    const all = await Software.find().lean();

    const totalSpend = all.reduce((s, x) => s + totalCost(x), 0);
    const saasSpend  = all.filter(x => x.deploymentType === 'SAAS').reduce((s, x) => s + totalCost(x), 0);
    const freeCount  = all.filter(x => totalCost(x) === 0).length;
    const paidCount  = all.filter(x => totalCost(x) > 0).length;
    const totalLic   = all.reduce((s, x) => s + (x.purchasedLicenses || 0), 0);
    const usedLic    = all.reduce((s, x) => s + (x.usedLicenses || 0), 0);
    const topApps    = [...all]
      .sort((a, b) => totalCost(b) - totalCost(a))
      .slice(0, 5)
      .map(x => ({
        csvId: x.csvId, name: x.name, annualCost: totalCost(x),
        baseCost: x.annualCost, serviceCount: (x.services || []).length,
        deploymentType: x.deploymentType, department: x.department,
      }));
    const byType = {};
    all.forEach(x => { const t = x.deploymentType; byType[t] = (byType[t] || 0) + totalCost(x); });

    res.json({ totalSpend, saasSpend, freeCount, paidCount, totalApps: all.length, totalLic, usedLic, topApps, byType });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/software ─────────────────────────────────────────────────────────
router.post('/', requireAuth, canWriteSoftware, async (req, res) => {
  try {
    const sw = await Software.create(req.body);
    const o  = fmtSw(sw);
    await writeLog({
      eventType: 'asset_created', entityType: 'asset',
      entityId: o.id, entityLabel: o.name,
      summary: `Software added: ${o.name} (${o.csvId})`,
    });
    res.status(201).json(o);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ── PUT /api/software/:id ──────────────────────────────────────────────────────
router.put('/:id', requireAuth, canWriteSoftware, async (req, res) => {
  try {
    // Use findById + save so nested arrays (services) are properly validated
    const sw = await Software.findById(req.params.id);
    if (!sw) return res.status(404).json({ error: 'Software not found' });

    const allowed = [
      'csvId', 'name', 'deploymentType', 'renewalPeriod', 'department', 'purpose',
      'licensePricePerUserMonth', 'annualCost', 'subscriptionPlan', 'purchasedLicenses',
      'usedLicenses', 'owner', 'admins', 'billedTo', 'status',
      'siteUSA', 'siteCAN', 'siteIND', 'services',
    ];
    allowed.forEach(k => { if (req.body[k] !== undefined) sw[k] = req.body[k]; });
    await sw.save();

    const o = fmtSw(sw);
    res.json(o);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ── DELETE /api/software/:id ───────────────────────────────────────────────────
router.delete('/:id', requireAuth, canWriteSoftware, async (req, res) => {
  try {
    const sw = await Software.findByIdAndDelete(req.params.id);
    if (!sw) return res.status(404).json({ error: 'Software not found' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
