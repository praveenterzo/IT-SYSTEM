/**
 * config.js — Central configuration constants
 * All environment variables and shared settings live here.
 * Import this instead of reading process.env directly in route files.
 */
require('dotenv').config();

module.exports = {
  PORT:        process.env.PORT        || 3000,
  JWT_SECRET:  process.env.JWT_SECRET  || 'terzocloud_jwt_secret_2025',
  JWT_EXPIRES: process.env.JWT_EXPIRES || '24h',
  MONGO_URI:   process.env.MONGO_URI   || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/terzocloud_assets',
  ACTOR:       process.env.LOG_ACTOR   || 'Praveen M. (IT Admin)',
};
