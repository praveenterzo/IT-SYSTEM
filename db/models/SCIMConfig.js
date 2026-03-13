const mongoose = require('mongoose');

const SCIMConfigSchema = new mongoose.Schema({
  enabled:     { type: Boolean, default: false },
  bearerToken: { type: String,  default: '' },   // stored plain; compared on every SCIM request
  tokenHint:   { type: String,  default: '' },   // last 6 chars, shown in admin UI
}, { timestamps: true });

module.exports = mongoose.model('SCIMConfig', SCIMConfigSchema);
