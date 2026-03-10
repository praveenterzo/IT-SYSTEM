const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    legacyId: {
      type: String,
      unique: true,
      sparse: true,
    },
    empId: {
      type: String,
      default: '',
      trim: true,
      comment: 'Employee ID from HR (e.g. E001)',
    },
    first: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
    },
    last: {
      type: String,
      default: '',
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
    },
    role: {
      type: String,
      enum: ['Admin', 'Manager', 'Editor', 'Viewer'],
      default: 'Viewer',
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive'],
      default: 'Active',
    },
    jobTitle: {
      type: String,
      default: '',
      trim: true,
    },
    dept: {
      type: String,
      required: [true, 'Department is required'],
      enum: [
        'Engineering',
        'AI-Service',
        'QA',
        'IT',
        'HR',
        'Product',
        'Customer Support',
        'Accounts',
        'Data Science',
        'Sales',
        'Marketing',
        'Legal',
        'Executive',
        'Operations',
        'Finance',
        'Other',
      ],
    },
    location: {
      type: String,
      enum: ['Chennai', 'Coimbatore', 'Remote'],
      default: 'Chennai',
    },
    employmentType: {
      type: String,
      enum: ['Full Time', 'Part Time', 'Contractor'],
      default: 'Full Time',
    },
    phone: {
      type: String,
      default: '',
      trim: true,
    },
    joined: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true, // adds createdAt & updatedAt
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual: full name
userSchema.virtual('fullName').get(function () {
  return `${this.first} ${this.last}`.trim();
});

// Virtual: assets currently assigned to this user
userSchema.virtual('assignedAssets', {
  ref: 'Asset',
  localField: '_id',
  foreignField: 'assignedTo',
});

// Indexes
userSchema.index({ dept: 1 });
userSchema.index({ location: 1 });
userSchema.index({ status: 1 });
userSchema.index({ role: 1 });
userSchema.index({ email: 1 }, { unique: true });

module.exports = mongoose.model('User', userSchema);
