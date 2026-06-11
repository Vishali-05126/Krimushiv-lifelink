const mongoose = require('mongoose');

const dbUrl = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/lifelink';
const dbName = process.env.MONGODB_DB || 'lifelink';

const connectDB = async (opts = {}) => {
  const maxRetries = Number(opts.retries ?? 5);
  const retryDelay = Number(opts.delayMs ?? 3000);
  const connectTimeout = Number(opts.connectTimeoutMs ?? 5000);

  let attempt = 0;

  return new Promise((resolve) => {
    const tryConnect = async () => {
      attempt += 1;
      console.log(`[DB] Attempt ${attempt}/${maxRetries} → ${dbUrl.replace(/\/\/.*@/, '//****@')}`);
      try {
        await mongoose.connect(dbUrl, {
          dbName,
          connectTimeoutMS: connectTimeout,
          serverSelectionTimeoutMS: connectTimeout,
        });
        console.log('✅ MongoDB connected');
        resolve(true);
      } catch (err) {
        console.warn(`[DB] Attempt ${attempt} failed: ${err.message}`);
        if (attempt < maxRetries) {
          console.log(`[DB] Retrying in ${retryDelay}ms...`);
          setTimeout(tryConnect, retryDelay);
        } else {
          console.error('[DB] All connection attempts failed. Continuing without DB — file fallback active.');
          resolve(false);
        }
      }
    };
    tryConnect();
  });
};

module.exports = { connectDB };
