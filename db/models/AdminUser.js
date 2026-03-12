/**
 * AdminUser.js — Portal admin / RBAC user accounts
 * Completely separate from the employee User model.
 */
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const adminUserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Enter a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
    },
    role: {
      type: String,
      enum: ['super_admin', 'admin', 'viewer', 'it_manager'],
      default: 'viewer',
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive'],
      default: 'Active',
    },
    lastLogin: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Hash password before save (only when modified)
// Mongoose v7+: async pre-hooks must NOT call next() — just return/throw
adminUserSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

// Instance method: compare plain password with hash
adminUserSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

// email index already created by unique:true on the field — only add role index
adminUserSchema.index({ role: 1 });

module.exports = mongoose.model('AdminUser', adminUserSchema);
