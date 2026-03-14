/**
 * routes/auth.routes.js — Authentication routes
 *
 * POST /api/auth/login         — email + password login → JWT
 * GET  /api/auth/me            — validate token, return current user
 * GET  /api/auth/google/status — is Google SSO configured?
 * GET  /api/auth/google        — initiate Google OAuth2 flow
 * GET  /api/auth/google/callback — exchange code, issue JWT
 *
 * All routes here are PUBLIC (no requireAuth) except /me.
 */
const router  = require('express').Router();
const jwt     = require('jsonwebtoken');
const { AdminUser, IntegrationSettings } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { JWT_SECRET, JWT_EXPIRES } = require('../config');
const { httpsGet, httpsPost } = require('../utils/http');

// ── POST /api/auth/login ───────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
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

    user.lastLogin = new Date();
    await user.save();

    const payload = { id: user._id.toString(), email: user.email, name: user.name, role: user.role };
    const token   = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
    res.json({ token, user: { id: payload.id, name: user.name, email: user.email, role: user.role } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/auth/me ───────────────────────────────────────────────────────────
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await AdminUser.findById(req.user.id).select('-password').lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ id: user._id.toString(), name: user.name, email: user.email, role: user.role, status: user.status });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/auth/google/status ────────────────────────────────────────────────
router.get('/google/status', async (req, res) => {
  try {
    const s = await IntegrationSettings.findOne({ provider: 'google' });
    res.json({ enabled: !!(s && s.enabled && s.clientId && s.clientSecret) });
  } catch { res.json({ enabled: false }); }
});

// ── GET /api/auth/google — initiate OAuth2 flow ────────────────────────────────
router.get('/google', async (req, res) => {
  try {
    const s = await IntegrationSettings.findOne({ provider: 'google' });
    if (!s || !s.enabled || !s.clientId) return res.redirect('/login?sso_error=disabled');
    const redirectUri = `${req.protocol}://${req.get('host')}/api/auth/google/callback`;
    const params = new URLSearchParams({
      client_id:     s.clientId,
      redirect_uri:  redirectUri,
      response_type: 'code',
      scope:         'openid email profile',
      access_type:   'online',
      prompt:        'select_account',
    });
    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  } catch { res.redirect('/login?sso_error=server'); }
});

// ── GET /api/auth/google/callback ─────────────────────────────────────────────
router.get('/google/callback', async (req, res) => {
  try {
    const { code, error: oauthErr } = req.query;
    if (oauthErr) return res.redirect('/login?sso_error=denied');
    if (!code)    return res.redirect('/login?sso_error=nocode');

    const s = await IntegrationSettings.findOne({ provider: 'google' });
    if (!s || !s.enabled) return res.redirect('/login?sso_error=disabled');

    const redirectUri = `${req.protocol}://${req.get('host')}/api/auth/google/callback`;

    // Exchange code for access token
    const tokenData = await httpsPost('oauth2.googleapis.com', '/token', {
      code,
      client_id:     s.clientId,
      client_secret: s.clientSecret,
      redirect_uri:  redirectUri,
      grant_type:    'authorization_code',
    });
    if (tokenData.error) return res.redirect('/login?sso_error=token');

    // Get Google profile
    const profile = await httpsGet(
      `https://www.googleapis.com/oauth2/v2/userinfo?access_token=${encodeURIComponent(tokenData.access_token)}`
    );
    if (!profile.email) return res.redirect('/login?sso_error=noemail');

    // Domain restriction check
    if (s.allowedDomain) {
      const domain = profile.email.split('@')[1] || '';
      if (domain.toLowerCase() !== s.allowedDomain.toLowerCase())
        return res.redirect('/login?sso_error=domain');
    }

    // Must already exist as a portal admin user
    const adminUser = await AdminUser.findOne({ email: profile.email.toLowerCase() });
    if (!adminUser)              return res.redirect('/login?sso_error=notfound');
    if (adminUser.status === 'Inactive') return res.redirect('/login?sso_error=inactive');

    adminUser.lastLogin = new Date();
    await adminUser.save();

    const payload = { id: adminUser._id.toString(), email: adminUser.email, name: adminUser.name, role: adminUser.role };
    const token   = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
    res.redirect(`/login?sso_token=${encodeURIComponent(token)}`);
  } catch (e) {
    console.error('[AUTH] Google OAuth callback error:', e.message);
    res.redirect('/login?sso_error=server');
  }
});

module.exports = router;
