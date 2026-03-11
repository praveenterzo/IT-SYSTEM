const mongoose = require('mongoose');

const softwareSchema = new mongoose.Schema(
  {
    csvId: {
      type: String, unique: true, required: true, uppercase: true, trim: true,
    },
    name:       { type: String, required: true, trim: true },
    owner:      { type: String, default: '', trim: true },
    admins:     { type: String, default: '', trim: true },
    billedTo:   { type: String, default: '', trim: true },
    deploymentType: {
      type: String,
      enum: ['SAAS', 'On-premises', 'Freeware', 'Open Source'],
      default: 'SAAS',
    },
    department:       { type: String, default: '', trim: true },
    purpose:          { type: String, default: '', trim: true },
    subscriptionPlan: { type: String, default: '', trim: true },
    renewalPeriod: {
      type: String,
      enum: ['Annual', 'Monthly', 'Quarterly', 'Freeware', 'Pay-as-you-go', ''],
      default: '',
    },
    annualCost:             { type: Number, default: 0 },
    licensePricePerUserMonth: { type: Number, default: 0 },
    purchasedLicenses:      { type: Number, default: 0 },
    usedLicenses:           { type: Number, default: 0 },

    // Active sites
    siteUSA: { type: Boolean, default: false },
    siteCAN: { type: Boolean, default: false },
    siteIND: { type: Boolean, default: false },

    // Allocated cost per site (annual)
    costUSA: { type: Number, default: 0 },
    costCAN: { type: Number, default: 0 },
    costIND: { type: Number, default: 0 },

    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
  },
  { timestamps: true }
);

softwareSchema.index({ deploymentType: 1 });
softwareSchema.index({ department: 1 });
softwareSchema.index({ status: 1 });
softwareSchema.index({ annualCost: -1 });

module.exports = mongoose.model('Software', softwareSchema);
