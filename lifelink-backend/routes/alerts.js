const express = require('express');
const router = express.Router();
<<<<<<< HEAD
const mongoose = require('mongoose');
const Alert = require('../models/Alert');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const fileAlertStore = require('../utils/fileAlertStore');
const fileAuthStore = require('../utils/fileAuthStore');

const isDbReady = () => mongoose.connection.readyState === 1;
=======
const Alert = require('../models/Alert');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
>>>>>>> 8d23fc7 (commit)

// ── GET /api/alerts ──────────────────────────
// Fetch open alerts, optionally filtered by blood type or location
router.get('/', protect, async (req, res) => {
  try {
<<<<<<< HEAD
    if (!isDbReady()) {
      const alerts = await fileAlertStore.listForDonor(req.user, req.query);
      return res.json({ alerts });
    }

    const { bloodType, lat, lng, radius = 20000, ownOnly } = req.query; // radius in meters

    let query = {};

    if (ownOnly === 'true') {
      // Hospitals see all their requests (open, accepted, fulfilled)
      query = { requestedBy: req.user._id };
    } else {
      query.status = 'open';
      query.expiresAt = { $gt: new Date() };
    }

=======
    const { bloodType, lat, lng, radius = 20000 } = req.query; // radius in meters

    let query = { status: 'open', expiresAt: { $gt: new Date() } };
>>>>>>> 8d23fc7 (commit)
    if (bloodType) query.bloodType = { $in: [bloodType, 'O-'] }; // O- is universal

    let alerts;

    if (lat && lng) {
      // Geo query — find alerts near user
      alerts = await Alert.find({
        ...query,
        'hospital.location': {
          $near: {
            $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
            $maxDistance: parseInt(radius),
          },
        },
      })
        .populate('requestedBy', 'name bloodType')
        .sort({ createdAt: -1 })
        .limit(20);
    } else {
      alerts = await Alert.find(query)
        .populate('requestedBy', 'name bloodType')
        .sort({ severity: 1, createdAt: -1 })
        .limit(20);
    }

    res.json({ alerts });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/alerts ─────────────────────────
// Hospital or admin creates a new blood request alert
router.post('/', protect, async (req, res) => {
  try {
<<<<<<< HEAD
    const { type, severity, title, message, bloodType, unitsNeeded, hospital, location } = req.body;

    let alertHospital = hospital;

    // For SOS alerts, find nearest hospital if not provided
    if (type === 'emergency_sos' && !hospital && location) {
      const Hospital = require('../models/Hospital');
      const nearest = await Hospital.findOne({
        location: {
          $near: {
            $geometry: { type: 'Point', coordinates: [location.lng, location.lat] },
            $maxDistance: 20000, // 20km
          },
        },
        hasBloodBank: true,
        isOpen: true,
      });
      if (nearest) {
        alertHospital = {
          name: nearest.name,
          address: nearest.address,
          location: {
            type: 'Point',
            coordinates: nearest.location.coordinates,
          },
        };
      }
    }

    const alert = await Alert.create({
      type, severity, title, message, bloodType, unitsNeeded,
      hospital: alertHospital, requestedBy: req.user._id,
=======
    const { type, severity, title, message, bloodType, unitsNeeded, hospital } = req.body;

    const alert = await Alert.create({
      type, severity, title, message, bloodType, unitsNeeded,
      hospital, requestedBy: req.user._id,
>>>>>>> 8d23fc7 (commit)
    });

    // Emit to all connected clients via Socket.IO
    const io = req.app.get('io');
<<<<<<< HEAD
    if (io) {
      io.emit('new_alert', alert);
      if (type === 'emergency_sos' || severity === 'critical') {
        io.emit('emergency_alert', {
          bloodType,
          location: alertHospital?.location || location || null,
          message: message || title || 'Emergency blood request',
        });
      }
    }
=======
    if (io) io.emit('new_alert', alert);
>>>>>>> 8d23fc7 (commit)

    res.status(201).json({ alert });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── PUT /api/alerts/:id/accept ───────────────
// Donor accepts a blood request
router.put('/:id/accept', protect, async (req, res) => {
  try {
<<<<<<< HEAD
    if (req.user.role !== 'donor') {
      return res.status(403).json({ message: 'Only donors can accept blood requests' });
    }
    if (req.user.isAvailable === false || req.user.status === 'busy') {
      return res.status(400).json({ message: 'You are marked busy. Change availability before accepting.' });
    }

    if (!isDbReady()) {
      const alert = await fileAlertStore.mark(req.params.id, 'accepted', req.user);
      if (!alert) return res.status(404).json({ message: 'Alert not found' });
      const user = await fileAuthStore.recordAcceptedDonation(req.user._id || req.user.id, {
        donationsToAdd: 1,
        livesSavedToAdd: 3,
      });
      return res.json({ alert, user, message: 'Request accepted. Hospital location shared and donation rate updated.' });
    }

=======
>>>>>>> 8d23fc7 (commit)
    const alert = await Alert.findById(req.params.id);
    if (!alert) return res.status(404).json({ message: 'Alert not found' });
    if (alert.status !== 'open') return res.status(400).json({ message: 'Alert already accepted' });

    alert.status = 'accepted';
    alert.acceptedBy = req.user._id;
    await alert.save();

<<<<<<< HEAD
    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        lastDonation: new Date(),
        status: 'busy',
        isAvailable: false,
        $inc: { donations: 1, livesSaved: 3 },
      },
      { new: true }
    );

    // Notify all clients of the status change
    const io = req.app.get('io');
    if (io) io.emit('alert_updated', { id: alert._id, status: 'accepted', acceptedBy: req.user.name });
    return res.json({ alert, user, message: 'Request accepted. Hospital location shared and donation rate updated.' });
=======
    // Notify all clients of the status change
    const io = req.app.get('io');
    if (io) io.emit('alert_updated', { id: alert._id, status: 'accepted', acceptedBy: req.user.name });
>>>>>>> 8d23fc7 (commit)

    res.json({ alert, message: 'Request accepted — navigate to hospital' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── PUT /api/alerts/:id/fulfill ──────────────
// Mark donation as complete
<<<<<<< HEAD
// Donor rejects a blood request because they are unavailable.
router.put('/:id/reject', protect, async (req, res) => {
  try {
    if (req.user.role !== 'donor') {
      return res.status(403).json({ message: 'Only donors can reject blood requests' });
    }

    if (!isDbReady()) {
      const alert = await fileAlertStore.mark(req.params.id, 'rejected', req.user);
      if (!alert) return res.status(404).json({ message: 'Alert not found' });
      return res.json({ alert, message: 'Request declined. Your donation count was not changed.' });
    }

    const alert = await Alert.findById(req.params.id);
    if (!alert) return res.status(404).json({ message: 'Alert not found' });
    if (alert.status !== 'open') return res.status(400).json({ message: 'Alert already handled' });

    alert.status = 'rejected';
    await alert.save();

    const io = req.app.get('io');
    if (io) io.emit('alert_updated', { id: alert._id, status: 'rejected', rejectedBy: req.user.name });

    res.json({ alert, message: 'Request declined. Your donation count was not changed.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

=======
>>>>>>> 8d23fc7 (commit)
router.put('/:id/fulfill', protect, async (req, res) => {
  try {
    const alert = await Alert.findByIdAndUpdate(
      req.params.id,
      { status: 'fulfilled' },
      { new: true }
    );

<<<<<<< HEAD
=======
    // Increment donor's donation count and lives saved
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { donations: 1, livesSaved: 1 },
      lastDonation: new Date(),
    });

>>>>>>> 8d23fc7 (commit)
    const io = req.app.get('io');
    if (io) io.emit('alert_updated', { id: alert._id, status: 'fulfilled' });

    res.json({ alert, message: 'Donation confirmed — life saved!' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/alerts/nearby-donors ────────────
// Find verified donors near a hospital for a specific blood type
router.get('/nearby-donors', protect, async (req, res) => {
  try {
<<<<<<< HEAD
    const { lat, lng, bloodType, radius = 10000, isEmergency = false } = req.query;
    const isEmergencyBool = isEmergency === 'true' || isEmergency === true;

    const donors = await User.find({
      role: 'donor',
=======
    const { lat, lng, bloodType, radius = 10000 } = req.query;

    const donors = await User.find({
      role: 'donor',
      isAvailable: true,
      bloodType: { $in: [bloodType, 'O-'] },
>>>>>>> 8d23fc7 (commit)
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
          $maxDistance: parseInt(radius),
        },
      },
    })
<<<<<<< HEAD
      .select('name bloodType donations location isAvailable status verifiedBadge lastDonation diseases hemoglobin healthScore')
      .limit(100); // Get more for ranking

    // Calculate distance for each donor
    const donorsWithDistance = donors.map(donor => {
      const donorLng = donor.location.coordinates[0];
      const donorLat = donor.location.coordinates[1];
      const distance = getDistance(parseFloat(lat), parseFloat(lng), donorLat, donorLng);
      return { ...donor.toObject(), distance };
    });

    const DonorEligibility = require('../utils/donorEligibility');
    const request = {
      bloodType,
      location: { lat: parseFloat(lat), lng: parseFloat(lng) },
      isEmergency: isEmergencyBool,
    };

    const rankedDonors = DonorEligibility.filterAndRankDonors(donorsWithDistance, request);
    res.json({ donors: rankedDonors, count: rankedDonors.length });
=======
      .select('name bloodType trustScore donations location isAvailable verifiedBadge')
      .limit(10);

    res.json({ donors, count: donors.length });
>>>>>>> 8d23fc7 (commit)
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

<<<<<<< HEAD
// Helper function to calculate distance between two points (Haversine formula)
function getDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

=======
>>>>>>> 8d23fc7 (commit)
module.exports = router;
