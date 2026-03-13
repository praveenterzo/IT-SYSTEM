const mongoose = require('mongoose');

const AppConnectorSchema = new mongoose.Schema({
  appName: {
    type: String,
    required: true,
    unique: true,
    enum: ['github', 'slack', 'google_workspace'],
  },
  displayName:    { type: String, default: '' },
  softwareCsvId:  { type: String, default: '' },   // links to Software record (e.g. 'A-05')
  enabled:        { type: Boolean, default: false },
  apiToken:       { type: String,  default: '' },  // GitHub PAT / Slack Bot Token / GWS service account JSON
  tokenHint:      { type: String,  default: '' },  // last 4 chars for display (or 'JSON' for GWS)
  orgSlug:        { type: String,  default: '' },  // GitHub org / Slack workspace / GWS admin email
  lastSyncAt:     { type: Date,    default: null },
  lastSyncStatus: { type: String,  enum: ['success', 'error', 'never'], default: 'never' },
  lastSyncMessage:{ type: String,  default: '' },
  cachedUserCount:{ type: Number,  default: 0 },
  cachedPlan:     { type: String,  default: '' },
}, { timestamps: true });

module.exports = mongoose.model('AppConnector', AppConnectorSchema);
