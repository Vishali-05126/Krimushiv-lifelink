const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const Hospital = require('../models/Hospital');
const Alert = require('../models/Alert');

// GET /api/map/locations?role=donor|receiver|hospital|bloodbank
// Returns relevant map markers for the user's role
router.get('/embed-url', (req, res) => {
  const key = process.env.GOOGLE_MAPS_API_KEY || '';
  if (!key || key === 'YOUR_GOOGLE_MAPS_API_KEY') {
    return res.json({ configured: false });
  }
  const { lat, lng, zoom = 13 } = req.query;
  const center = (lat && lng) ? `${lat},${lng}` : '13.0827,80.2707';
  const src = `https://www.google.com/maps/embed/v1/place?key=${key}&q=${encodeURIComponent(center)}&zoom=${zoom}`;
  res.json({ configured: true, src });
});

// GET /api/map/locations?role=donor|receiver|hospital|bloodbank
// Returns relevant map markers for the user's role
router.get('/locations', protect, async (req, res) => {
  try {
    const { role, lat, lng, radius = 15000, bloodType } = req.query;
    const userId = req.user._id;
    const userRole = req.user.role || role;

    let markers = [];

    if (userRole === 'donor') {
      // Donor sees: open alerts/hospitals needing blood + nearby receivers
      const alerts = await Alert.find({
        status: 'open',
        expiresAt: { $gt: new Date() },
        ...(lat && lng ? {
          'hospital.location': {
            $near: {
              $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
              $maxDistance: parseInt(radius, 10),
            },
          },
        } : {}),
        ...(bloodType ? { bloodType: { $in: [bloodType, 'O-'] } } : {}),
      })
        .populate('requestedBy', 'name bloodType location')
        .limit(20)
        .lean();

      markers = alerts.map(a => ({
        id: a._id,
        type: 'hospital',
        name: a.hospital?.name || 'Hospital',
        address: a.hospital?.address || '',
        lat: a.hospital?.location?.coordinates?.[1],
        lng: a.hospital?.location?.coordinates?.[0],
        bloodType: a.bloodType,
        unitsNeeded: a.unitsNeeded,
        severity: a.severity,
        title: a.title,
        status: a.status,
      }));

      // Add receivers (patients) who created alerts
      alerts.forEach(a => {
        if (a.requestedBy?.location?.coordinates) {
          const [rlng, rlat] = a.requestedBy.location.coordinates;
          markers.push({
            id: `receiver-${a.requestedBy._id}`,
            type: 'receiver',
            name: a.requestedBy.name || 'Receiver',
            lat: rlat,
            lng: rlng,
            bloodType: a.requestedBy.bloodType,
            alertId: a._id,
          });
        }
      });
    }

    if (userRole === 'receiver') {
      // Receiver sees: nearby hospitals + blood banks + matching donors
      const hospitals = await Hospital.find({
        ...(lat && lng ? {
          location: {
            $near: {
              $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
              $maxDistance: parseInt(radius, 10),
            },
          },
        } : {}),
      })
        .limit(20)
        .lean();

      markers = hospitals.map(h => ({
        id: h._id,
        type: 'hospital',
        name: h.name,
        address: h.address || '',
        lat: h.location?.coordinates?.[1],
        lng: h.location?.coordinates?.[0],
        hasBloodBank: h.hasBloodBank,
        isOpen: h.isOpen,
        phone: h.phone,
      }));

      // Add matching donors if bloodType provided
      if (bloodType) {
        const donors = await User.find({
          role: 'donor',
          bloodType: { $in: [bloodType, 'O-'] },
          ...(lat && lng ? {
            location: {
              $near: {
                $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
                $maxDistance: parseInt(radius, 10),
              },
            },
          } : {}),
        })
          .select('name bloodType location status donations lastDonation')
          .limit(20)
          .lean();

        donors.forEach(d => {
          if (d.location?.coordinates) {
            const [dlng, dlat] = d.location.coordinates;
            markers.push({
              id: `donor-${d._id}`,
              type: 'donor',
              name: d.name,
              lat: dlat,
              lng: dlng,
              bloodType: d.bloodType,
              status: d.status,
              donations: d.donations,
            });
          }
        });
      }
    }

    if (userRole === 'hospital') {
      // Hospital sees: nearby blood banks + donors + receivers
      const bloodBanks = await User.find({
        role: 'bloodbank',
        ...(lat && lng ? {
          location: {
            $near: {
              $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
              $maxDistance: parseInt(radius, 10),
            },
          },
        } : {}),
      })
        .select('name bankName location operatingHours acceptingDonors')
        .limit(20)
        .lean();

      markers = bloodBanks.map(b => ({
        id: b._id,
        type: 'bloodbank',
        name: b.bankName || b.name,
        lat: b.location?.coordinates?.[1],
        lng: b.location?.coordinates?.[0],
        operatingHours: b.operatingHours,
        acceptingDonors: b.acceptingDonors,
      }));

      // Add donors
      const donors = await User.find({
        role: 'donor',
        ...(lat && lng ? {
          location: {
            $near: {
              $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
              $maxDistance: parseInt(radius, 10),
            },
          },
        } : {}),
      })
        .select('name bloodType location status donations')
        .limit(30)
        .lean();

      donors.forEach(d => {
        if (d.location?.coordinates) {
          const [dlng, dlat] = d.location.coordinates;
          markers.push({
            id: `donor-${d._id}`,
            type: 'donor',
            name: d.name,
            lat: dlat,
            lng: dlng,
            bloodType: d.bloodType,
            status: d.status,
            donations: d.donations,
          });
        }
      });

      // Add open alerts (receivers needing blood)
      const alerts = await Alert.find({
        status: 'open',
        expiresAt: { $gt: new Date() },
      })
        .populate('requestedBy', 'name location')
        .limit(15)
        .lean();

      alerts.forEach(a => {
        if (a.requestedBy?.location?.coordinates) {
          const [rlng, rlat] = a.requestedBy.location.coordinates;
          markers.push({
            id: `receiver-${a.requestedBy._id}`,
            type: 'receiver',
            name: a.requestedBy.name || 'Receiver',
            lat: rlat,
            lng: rlng,
            bloodType: a.bloodType,
            alertId: a._id,
            title: a.title,
          });
        }
      });
    }

    if (userRole === 'bloodbank') {
      // Blood bank sees: nearby hospitals + receivers
      const hospitals = await Hospital.find({
        ...(lat && lng ? {
          location: {
            $near: {
              $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
              $maxDistance: parseInt(radius, 10),
            },
          },
        } : {}),
      })
        .limit(20)
        .lean();

      markers = hospitals.map(h => ({
        id: h._id,
        type: 'hospital',
        name: h.name,
        address: h.address || '',
        lat: h.location?.coordinates?.[1],
        lng: h.location?.coordinates?.[0],
        hasBloodBank: h.hasBloodBank,
        isOpen: h.isOpen,
        phone: h.phone,
      }));

      // Add open alerts (receivers)
      const alerts = await Alert.find({
        status: 'open',
        expiresAt: { $gt: new Date() },
      })
        .populate('requestedBy', 'name location')
        .limit(15)
        .lean();

      alerts.forEach(a => {
        if (a.requestedBy?.location?.coordinates) {
          const [rlng, rlat] = a.requestedBy.location.coordinates;
          markers.push({
            id: `receiver-${a.requestedBy._id}`,
            type: 'receiver',
            name: a.requestedBy.name || 'Receiver',
            lat: rlat,
            lng: rlng,
            bloodType: a.bloodType,
            alertId: a._id,
            title: a.title,
          });
        }
      });
    }

    res.json({ markers, role: userRole });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
