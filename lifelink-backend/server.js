require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const http = require('http');
const path = require('path');
const { connectDB } = require('./config/db');

const fileDbFallbackEnabled = (process.env.NODE_ENV || 'development') === 'development' || process.env.FILE_DB_FALLBACK === 'true';

let socketio = null;
try {
  socketio = require('socket.io');
} catch (_err) {
  console.warn('Socket.IO is not installed. Real-time updates are disabled.');
}

const app = express();
const isProduction = (process.env.NODE_ENV || 'development') === 'production';

if (isProduction) {
  const missing = [];
  if (!process.env.JWT_SECRET) missing.push('JWT_SECRET');
  if (!process.env.MONGODB_URI && !process.env.MONGO_URI) missing.push('MONGODB_URI');
  if (missing.length) {
    console.error(`Missing required production environment variable(s): ${missing.join(', ')}`);
  }
}

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../lifelink-frontend')));

app.use((req, res, next) => {
  const isApiRequest = req.originalUrl.startsWith('/api');
  const isHealthCheck = req.originalUrl === '/api/health';
  const hasDemoFallback =
    (req.method === 'GET' && req.originalUrl === '/api/bloodbank/features') ||
    (req.method === 'POST' && req.originalUrl === '/api/bloodbank/records') ||
    (req.method === 'POST' && req.originalUrl === '/api/ai/triage') ||
    (req.method === 'POST' && req.originalUrl === '/api/ai/donor-match-explain');
  const hasFileFallback = fileDbFallbackEnabled && (
    req.originalUrl.startsWith('/api/auth') ||
    req.originalUrl.startsWith('/api/alerts')
  );
  if (isApiRequest && !isHealthCheck && !hasDemoFallback && !hasFileFallback && mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      message: 'LifeLink is still connecting to the database. Please wait a few seconds and try again.'
    });
  }
  next();
});

// ── Routes ────────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/alerts', require('./routes/alerts'));
app.use('/api/hospitals', require('./routes/hospitals'));
app.use('/api/insights', require('./routes/insights'));
app.use('/api/bloodbank', require('./routes/bloodbank'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/map', require('./routes/map'));
app.use('/api', require('./routes/match'));

// ── Health check ─────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  const mongoConnected = mongoose.connection.readyState === 1;
  res.json({
    status: mongoConnected || fileDbFallbackEnabled ? 'ok' : 'degraded',
    message: 'LifeLink backend running',
    database: mongoConnected ? 'mongodb connected' : 'local file auth fallback',
    uptime: process.uptime(),
    timestamp: new Date()
  });
});

// ── Seed sample data (dev only) ──────────────────────────────────
const isDev = (process.env.NODE_ENV || 'development') === 'development';
if (isDev) {
  app.post('/api/dev/seed', async (req, res) => {
    try {
      const Hospital = require('./models/Hospital');
      const Alert = require('./models/Alert');

      await Hospital.deleteMany({});
      await Alert.deleteMany({});

      await Hospital.insertMany([
        {
          name: "St. Mary's Hospital", address: 'Anna Salai, Chennai',
          phone: '+91-44-2222-3333',
          location: { type: 'Point', coordinates: [80.2707, 13.0827], city: 'Chennai' },
          isOpen: true, openHours: '24/7', bedsAvailable: 12, doctorsOnDuty: 4,
          hasBloodBank: true, isTraumaCentre: true, acceptingDonors: true,
          bloodStock: { 'O-': 2, 'O+': 14, 'A-': 5, 'A+': 18, 'B-': 3, 'B+': 9, 'AB-': 1, 'AB+': 12 },
          rating: 4.8,
        },
        {
          name: 'City General Hospital', address: 'T. Nagar, Chennai',
          phone: '+91-44-2333-4444',
          location: { type: 'Point', coordinates: [80.2341, 13.0418], city: 'Chennai' },
          isOpen: true, openHours: '24/7', bedsAvailable: 8, doctorsOnDuty: 3,
          hasBloodBank: true, hasOrganFacility: true, acceptingDonors: true,
          bloodStock: { 'O-': 5, 'O+': 20, 'A-': 8, 'A+': 22, 'B-': 4, 'B+': 11, 'AB-': 2, 'AB+': 15 },
          rating: 4.6,
        },
        {
          name: 'Apollo Hospitals', address: 'Greams Road, Chennai',
          phone: '+91-44-2829-3333',
          location: { type: 'Point', coordinates: [80.2565, 13.0620], city: 'Chennai' },
          isOpen: true, openHours: '24/7', bedsAvailable: 25, doctorsOnDuty: 8,
          hasBloodBank: true, hasOrganFacility: true, isTraumaCentre: true, acceptingDonors: false,
          bloodStock: { 'O-': 8, 'O+': 30, 'A-': 12, 'A+': 28, 'B-': 6, 'B+': 16, 'AB-': 3, 'AB+': 20 },
          rating: 4.9,
        },
      ]);

      await Alert.insertMany([
        {
          type: 'blood_request', severity: 'critical',
          title: "St. Mary's needs O- urgently",
          message: "St. Mary's Hospital urgently needs O- blood for trauma surgery. Patient: Female, 34.",
          bloodType: 'O-', unitsNeeded: 2,
          hospital: {
            name: "St. Mary's Hospital", address: 'Anna Salai, Chennai',
            location: { type: 'Point', coordinates: [80.2707, 13.0827] },
          },
        },
        {
          type: 'low_stock', severity: 'warning',
          title: 'AB- critically low at City General',
          message: 'AB- stock critical (2 units). Donors with AB- blood needed urgently.',
          bloodType: 'AB-', unitsNeeded: 5,
          hospital: {
            name: 'City General', address: 'T. Nagar, Chennai',
            location: { type: 'Point', coordinates: [80.2341, 13.0418] },
          },
        },
      ]);

      res.json({ message: 'Seed data inserted successfully' });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });
}

// Connect DB immediately for serverless
connectDB({ retries: 1, delayMs: 500, connectTimeoutMs: 3000 }).catch(() => {});

// Export for Vercel serverless functions
module.exports = app;

// Start local server only in development
if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  const httpServer = http.createServer(app);
  const io = socketio ? socketio(httpServer, { cors: { origin: "*" } }) : null;
  if (io) app.set('io', io);

  httpServer.listen(PORT, () => {
    console.log(`LifeLink backend running on http://localhost:${PORT}`);
  });

  httpServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use.`);
    } else {
      console.error('Server error:', err);
    }
    process.exit(1);
  });
}
