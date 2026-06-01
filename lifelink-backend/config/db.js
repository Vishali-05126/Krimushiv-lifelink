const mongoose = require('mongoose');

const dbUrl = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/lifelink';

// Disable buffering so we fail fast if the DB is down
mongoose.set('bufferCommands', false);

/**
 * Connect to MongoDB with simple retry logic. This avoids crashing the entire
 * server when the DB isn't available immediately (useful during local dev).
 */
const connectDB = async (opts = {}) => {
  const maxRetries = Number(opts.retries ?? 5);
  const retryDelay = Number(opts.delayMs ?? 3000);

  let attempt = 0;

  return new Promise((resolve) => {
    const tryConnect = async () => {
      attempt += 1;
      console.log(`ðŸ“¡ Attempting to connect to: ${dbUrl.replace(/:([^:@]+)@/, ':****@')}`);
      try {
        await mongoose.connect(dbUrl, {
          // mongoose v7 uses these by default but keeping for clarity
          useNewUrlParser: true,
          useUnifiedTopology: true,
        });
        console.log('âœ… MongoDB connected');
        resolve(true);
      } catch (err) {
        console.warn(`âŒ MongoDB connect attempt ${attempt} failed: ${err.message}`);
        if (attempt < maxRetries) {
          console.log(`Retrying in ${retryDelay}ms... (${attempt}/${maxRetries})`);
          setTimeout(tryConnect, retryDelay);
        } else {
          console.error('âŒ All MongoDB connection attempts failed. Continuing without DB.');
          resolve(false);
        }
      }
    };
    tryConnect();
  });
};

module.exports = { connectDB };
