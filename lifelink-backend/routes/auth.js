const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const fileAuthStore = require('../utils/fileAuthStore');

const signToken = (id) =>
  jwt.sign(
    { id },
    process.env.JWT_SECRET || 'lifelink-dev-secret',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

const safeUser = (u) => ({
  id: u._id, name: u.name, email: u.email, role: u.role,
  phone: u.phone, isVerified: u.isVerified, verifiedBadge: u.verifiedBadge,
  location: u.location, createdAt: u.createdAt,
  // donor
  bloodType: u.bloodType, bloodReport: u.bloodReport, donations: u.donations,
  livesSaved: u.livesSaved, isAvailable: u.isAvailable, status: u.status,
  organDonor: u.organDonor, organsPledged: u.organsPledged, lastDonation: u.lastDonation,
  // receiver
  requiredBloodType: u.requiredBloodType, urgency: u.urgency, medicalCondition: u.medicalCondition,
  attendingHospital: u.attendingHospital, guardianName: u.guardianName,
  // hospital
  hospitalName: u.hospitalName, registrationNumber: u.registrationNumber,
  hospitalType: u.hospitalType, hasBloodBank: u.hasBloodBank,
  hasOrganFacility: u.hasOrganFacility, isTraumaCentre: u.isTraumaCentre,
  // blood bank
  bankName: u.bankName, licenseNumber: u.licenseNumber, bloodStock: u.bloodStock,
  acceptingDonors: u.acceptingDonors, operatingHours: u.operatingHours,
});

const isDbReady = () => mongoose.connection.readyState === 1;

// â”€â”€ POST /api/auth/register â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.post('/register', [
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').isIn(['donor', 'receiver', 'hospital', 'bloodbank']).withMessage('Valid role required'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ message: errors.array()[0].msg });

  try {
    const { role } = req.body;
    const existingUser = isDbReady()
      ? await User.findOne({ email: req.body.email })
      : await fileAuthStore.findByEmail(req.body.email);
    if (existingUser)
      return res.status(409).json({ message: 'Email already registered' });

    let userData = {
      name: req.body.name, email: req.body.email,
      password: req.body.password, role,
      phone: req.body.phone,
      location: {
        type: 'Point',
        coordinates: [parseFloat(req.body.lng) || 0, parseFloat(req.body.lat) || 0],
        city: req.body.city || '', address: req.body.address || '',
      },
    };

    // Role-specific fields
    if (role === 'donor') {
      if (!req.body.bloodType) return res.status(400).json({ message: 'Blood type required for donors' });
      Object.assign(userData, {
        bloodType: req.body.bloodType,
        bloodReport: req.body.bloodReport,
        dateOfBirth: req.body.dateOfBirth,
        gender: req.body.gender,
        weight: req.body.weight,
        medicalConditions: req.body.medicalConditions,
        organDonor: req.body.organDonor === true,
      });
    }

    if (role === 'receiver') {
      if (!req.body.requiredBloodType) return res.status(400).json({ message: 'Required blood type must be specified' });
      Object.assign(userData, {
        requiredBloodType: req.body.requiredBloodType,
        medicalCondition: req.body.medicalCondition,
        attendingHospital: req.body.attendingHospital,
        urgency: req.body.urgency || 'routine',
        guardianName: req.body.guardianName,
        guardianPhone: req.body.guardianPhone,
      });
    }

    if (role === 'hospital') {
      if (!req.body.hospitalName) return res.status(400).json({ message: 'Hospital name required' });
      Object.assign(userData, {
        hospitalName: req.body.hospitalName,
        registrationNumber: req.body.registrationNumber,
        hospitalType: req.body.hospitalType,
        bedCount: req.body.bedCount,
        hasBloodBank: req.body.hasBloodBank === true,
        hasOrganFacility: req.body.hasOrganFacility === true,
        isTraumaCentre: req.body.isTraumaCentre === true,
        contactPerson: req.body.contactPerson,
        website: req.body.website,
      });
    }

    if (role === 'bloodbank') {
      if (!req.body.bankName) return res.status(400).json({ message: 'Blood bank name required' });
      Object.assign(userData, {
        bankName: req.body.bankName,
        licenseNumber: req.body.licenseNumber,
        bankType: req.body.bankType,
        storageCapacity: req.body.storageCapacity,
        operatingHours: req.body.operatingHours,
        acceptingDonors: req.body.acceptingDonors !== false,
      });
    }

    const user = isDbReady()
      ? await User.create(userData)
      : await fileAuthStore.create(userData);
    res.status(201).json({ token: signToken(user._id), user: safeUser(user) });

  } catch (err) {
    if (err.code === 'DUPLICATE_EMAIL') {
      return res.status(409).json({ message: 'Email already registered' });
    }
    res.status(500).json({ message: err.message });
  }
});

// â”€â”€ POST /api/auth/login â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.post('/login', [
  body('email').isEmail(),
  body('password').notEmpty(),
  body('role').optional().isIn(['donor', 'receiver', 'hospital', 'bloodbank']),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ message: errors.array()[0]?.msg || 'Invalid login data' });

  try {
    const { email, password, role } = req.body;
    const user = isDbReady()
      ? await User.findOne({ email })
      : await fileAuthStore.findByEmail(email);
    if (!user || !(await user.matchPassword(password)) || (role && user.role !== role))
      return res.status(401).json({ message: 'Invalid email, password or role' });

    res.json({ token: signToken(user._id), user: safeUser(user) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// â”€â”€ GET /api/auth/me â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get('/me', async (req, res, next) => {
  if (isDbReady()) return protect(req, res, () => res.json({ user: safeUser(req.user) }));

  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'Not authorized, token missing' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'lifelink-dev-secret');
    const user = await fileAuthStore.findById(decoded.id);
    if (!user) return res.status(401).json({ message: 'Not authorized, user not found' });

    res.json({ user: safeUser(user) });
  } catch (err) {
    next(err);
  }
});

// â”€â”€ PUT /api/auth/location â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.put('/location', protect, async (req, res) => {
  const { lat, lng, city, address } = req.body;
  await User.findByIdAndUpdate(req.user._id, {
    location: { type: 'Point', coordinates: [parseFloat(lng) || 0, parseFloat(lat) || 0], city, address },
    isAvailable: true,
    status: 'available',
  });
  res.json({ message: 'Location updated' });
});

// â”€â”€ PUT /api/auth/availability â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.put('/availability', protect, async (req, res) => {
  const isAvailable = req.body.isAvailable === true;
  const status = isAvailable ? 'available' : 'busy';
  await User.findByIdAndUpdate(req.user._id, { isAvailable, status });
  res.json({ message: 'Availability updated', status });
});

// â€”â€” PUT /api/auth/status â€”â€”
// Update donor availability status (available | busy | offline)
router.put('/status', protect, async (req, res) => {
  const { status } = req.body;
  const allowed = ['available', 'busy', 'offline'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ message: 'Invalid status value' });
  }
  const isAvailable = status === 'available';
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { status, isAvailable },
    { new: true }
  );

  const io = req.app.get('io');
  if (io) io.emit('donor_status_changed', { userId: user._id, status });

  res.json({ user: safeUser(user), message: 'Status updated' });
});

// â”€â”€ PUT /api/auth/profile â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.put('/donation', protect, async (req, res) => {
  if (req.user.role !== 'donor') {
    return res.status(403).json({ message: 'Only donor accounts can record donations' });
  }

  const donationDate = req.body.donationDate ? new Date(req.body.donationDate) : new Date();
  if (Number.isNaN(donationDate.getTime())) {
    return res.status(400).json({ message: 'Valid donation date is required' });
  }

  const donationsToAdd = Number(req.body.donationsToAdd || 1);
  const livesSavedToAdd = Number(req.body.livesSavedToAdd || 3);

  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      lastDonation: donationDate,
      $inc: {
        donations: Number.isFinite(donationsToAdd) ? donationsToAdd : 1,
        livesSaved: Number.isFinite(livesSavedToAdd) ? livesSavedToAdd : 3,
      },
      status: 'busy',
      isAvailable: false,
    },
    { new: true }
  );

  res.json({ user: safeUser(user), message: 'Donation recorded' });
});

router.put('/profile', protect, async (req, res) => {
  const allowed = ['name', 'phone', 'bloodType', 'bloodReport', 'weight', 'medicalConditions',
    'requiredBloodType', 'urgency', 'attendingHospital', 'guardianName', 'guardianPhone',
    'hospitalName', 'contactPerson', 'website', 'bankName', 'operatingHours',
    'acceptingDonors', 'organDonor', 'organsPledged'];
  const updates = {};
  allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
  const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true });
  res.json({ user: safeUser(user) });
});

module.exports = router;
