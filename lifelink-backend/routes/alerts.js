const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Alert = require('../models/Alert');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const fileAlertStore = require('../utils/fileAlertStore');
const fileAuthStore = require('../utils/fileAuthStore');

const isDbReady = () => mongoose.connection.readyState === 1;

// GET /api/alerts
// Fetch open alerts, optionally filtered by blood type or location.
router.get('/', protect, async (req, res) => {
  try {
    if (!isDbReady()) {
      const alerts = await fileAlertStore.listForDonor(req.user, req.query);
      return res.json({ alerts });
    }

    const { bloodType, lat, lng, radius = 20000, ownOnly } = req.query;
    let query = {};

    if (ownOnly === 'true') {
      query = { requestedBy: req.user._id };
    } else {
      query.status = 'open';
      query.expiresAt = { $gt: new Date() };
    }

    if (bloodType) query.bloodType = { $in: [bloodType, 'O-'] };

    let alerts;
    if (lat && lng) {
      alerts = await Alert.find({
        ...query,
        'hospital.location': {
          $near: {
            $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
            $maxDistance: parseInt(radius, 10),
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

// POST /api/alerts
// Hospital or admin creates a new blood request alert.
router.post('/', protect, async (req, res) => {
  try {
    const { type, severity, title, message, bloodType, unitsNeeded, hospital, location } = req.body;
    let alertHospital = hospital;

    if (type === 'emergency_sos' && !hospital && location) {
      const Hospital = require('../models/Hospital');
      const nearest = await Hospital.findOne({
        location: {
          $near: {
            $geometry: { type: 'Point', coordinates: [location.lng, location.lat] },
            $maxDistance: 20000,
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
      type,
      severity,
      title,
      message,
      bloodType,
      unitsNeeded,
      hospital: alertHospital,
      requestedBy: req.user._id,
    });

    const io = req.app.get('io');
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

    res.status(201).json({ alert });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/alerts/:id/accept
// Donor accepts a blood request.
router.put('/:id/accept', protect, async (req, res) => {
  try {
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

    const alert = await Alert.findById(req.params.id);
    if (!alert) return res.status(404).json({ message: 'Alert not found' });
    if (alert.status !== 'open') return res.status(400).json({ message: 'Alert already accepted' });

    alert.status = 'accepted';
    alert.acceptedBy = req.user._id;
    await alert.save();

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

    const io = req.app.get('io');
    if (io) io.emit('alert_updated', { id: alert._id, status: 'accepted', acceptedBy: req.user.name });

    res.json({ alert, user, message: 'Request accepted. Hospital location shared and donation rate updated.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/alerts/:id/reject
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

// PUT /api/alerts/:id/fulfill
// Mark donation as complete.
router.put('/:id/fulfill', protect, async (req, res) => {
  try {
    const alert = await Alert.findByIdAndUpdate(
      req.params.id,
      { status: 'fulfilled' },
      { new: true }
    );
    if (!alert) return res.status(404).json({ message: 'Alert not found' });

    const io = req.app.get('io');
    if (io) io.emit('alert_updated', { id: alert._id, status: 'fulfilled' });

    res.json({ alert, message: 'Donation confirmed - life saved!' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/alerts/nearby-donors
// Find verified donors near a hospital for a specific blood type.
router.get('/nearby-donors', protect, async (req, res) => {
  try {
    const { lat, lng, bloodType, radius = 10000, isEmergency = false } = req.query;
    const isEmergencyBool = isEmergency === 'true' || isEmergency === true;

    const donors = await User.find({
      role: 'donor',
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
          $maxDistance: parseInt(radius, 10),
        },
      },
    })
      .select('name bloodType donations location isAvailable status verifiedBadge lastDonation diseases hemoglobin healthScore')
      .limit(100);

    const donorsWithDistance = donors.map((donor) => {
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
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

function getDistance(lat1, lng1, lat2, lng2) {
  const earthRadiusKm = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
    * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

module.exports = router;
