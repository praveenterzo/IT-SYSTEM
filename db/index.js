/**
 * db/index.js
 * MongoDB connection helper for TerzoCloud – User & Asset Management Portal
 *
 * Usage:
 *   const { connect, disconnect } = require('./db');
 *   await connect();
 */

const mongoose = require('mongoose');

const MONGO_URI =
  process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/terzocloud_assets';

/**
 * Connect to MongoDB.
 * Call this once at application startup.
 */
async function connect() {
  if (mongoose.connection.readyState >= 1) return; // already connected

  try {
    await mongoose.connect(MONGO_URI, {
      // Mongoose 7+ ignores deprecated options; kept here for clarity
    });
    console.log(`✅  MongoDB connected → ${MONGO_URI}`);
  } catch (err) {
    console.error('❌  MongoDB connection error:', err.message);
    process.exit(1);
  }
}

/**
 * Gracefully close the connection.
 * Useful in scripts (seed, migrations) and test teardown.
 */
async function disconnect() {
  await mongoose.disconnect();
  console.log('🔌  MongoDB disconnected');
}

// Re-export models so callers can do:
//   const { User, Asset } = require('./db');
const User     = require('./models/User');
const Asset    = require('./models/Asset');
const Log      = require('./models/Log');
const Software = require('./models/Software');

module.exports = { connect, disconnect, User, Asset, Log, Software };
