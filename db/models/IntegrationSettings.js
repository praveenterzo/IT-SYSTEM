/**
 * db/models/IntegrationSettings.js
 * Stores OAuth / SSO integration configuration for TerzoCloud Portal
 */

const mongoose = require('mongoose');

const IntegrationSettingsSchema = new mongoose.Schema({
  provider: { type: String, default: 'google', unique: true },
  enabled:        { type: Boolean, default: false },
  clientId:       { type: String,  default: '' },
  clientSecret:   { type: String,  default: '' },
  allowedDomain:  { type: String,  default: '' },  // e.g. "terzocloud.com"
}, { timestamps: true });

module.exports = mongoose.model('IntegrationSettings', IntegrationSettingsSchema);
