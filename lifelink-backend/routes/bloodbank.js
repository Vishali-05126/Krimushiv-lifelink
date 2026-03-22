const express = require('express');
const mongoose = require('mongoose');
const BloodUnit = require('../models/BloodUnit');
const User = require('../models/User');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const demoUnits = [
  {
    _id: 'bb-1',
    bloodBankName: 'LifeLink Central Blood Bank',
    bloodType: 'O-',
    component: 'red_cells',
    source: 'blood_bank',
    units: 4,
    collectionDate: new Date(Date.now() - 7 * MS_PER_DAY),
    expiryDate: new Date(Date.now() + 35 * MS_PER_DAY),
    shelfLifeDays: 42,
    status: 'critical',
    patientRecord: { patientId: 'PT-2048', hospital: 'St. Marys Hospital', issuedAt: new Date(), visibleToPatient: true },
    coldChainLogs: [{ temperatureC: 3.8, deviceId: 'IOT-RC-01', status: 'safe', recordedAt: new Date() }],
  },
  {
    _id: 'bb-2',
    bloodBankName: 'LifeLink Central Blood Bank',
    bloodType: 'A+',
    component: 'platelets',
    source: 'blood_bank',
    units: 7,
    collectionDate: new Date(Date.now() - 3 * MS_PER_DAY),
    expiryDate: new Date(Date.now() + 2 * MS_PER_DAY),
    shelfLifeDays: 5,
    status: 'low',
    patientRecord: { patientId: 'PT-2051', hospital: 'City General', issuedAt: new Date(), visibleToPatient: true },
    coldChainLogs: [{ temperatureC: 22.2, deviceId: 'IOT-PLT-04', status: 'safe', recordedAt: new Date() }],
  },
  {
    _id: 'bb-3',
    bloodBankName: 'Apollo Blood Bank',
    bloodType: 'B+',
    component: 'plasma',
    source: 'blood_bank',
    units: 18,
    collectionDate: new Date(Date.now() - 40 * MS_PER_DAY),
    expiryDate: new Date(Date.now() + 325 * MS_PER_DAY),
    shelfLifeDays: 365,
    status: 'available',
    patientRecord: { patientId: 'PT-2060', hospital: 'Apollo Hospitals', issuedAt: new Date(), visibleToPatient: true },
    coldChainLogs: [{ temperatureC: -28.4, deviceId: 'IOT-PLS-08', status: 'safe', recordedAt: new Date() }],
  },
];

const demoDonors = [
  { _id: 'donor-1', name: 'Riya Mehta', bloodType: 'O-', phone: '+91 90000 11111', distanceKm: 2.4, donations: 8, livesSaved: 24, totalLitresDonated: 3.6, status: 'available', digitalCardId: 'LL-O-8842', lastUsedAtHospital: 'City General' },
  { _id: 'donor-2', name: 'Arjun Rao', bloodType: 'A+', phone: '+91 90000 22222', distanceKm: 4.1, donations: 5, livesSaved: 15, totalLitresDonated: 2.2, status: 'available', digitalCardId: 'LL-A-2190', lastUsedAtHospital: 'St. Marys Hospital' },
  { _id: 'donor-3', name: 'Nisha Kumar', bloodType: 'AB-', phone: '+91 90000 33333', distanceKm: 7.8, donations: 11, livesSaved: 33, totalLitresDonated: 4.9, status: 'busy', digitalCardId: 'LL-AB-1027', lastUsedAtHospital: 'Apollo Hospitals' },
];

function isDbReady() {
  return mongoose.connection.readyState === 1;
}

function daysUntil(date) {
  return Math.ceil((new Date(date).getTime() - Date.now()) / MS_PER_DAY);
}

function expiryStatus(unit) {
  const days = daysUntil(unit.expiryDate);
  if (days < 0) return 'expired';
  if (days <= 2) return 'critical';
  if (days <= 7) return 'use_soon';
  return 'fresh';
}

function predictedShortages(units) {
  return units
    .filter((unit) => unit.units <= 8 || unit.bloodType === 'O-')
    .map((unit) => ({
      bloodType: unit.bloodType,
      component: unit.component,
      risk: Math.min(96, Math.max(45, 100 - unit.units * 4)),
      message: `${unit.bloodType} ${unit.component.replace('_', ' ')} may run low soon`,
    }));
}

function buildSnapshot(units, donors = demoDonors) {
  const normalized = units.map((unit) => {
    const plain = unit.toObject ? unit.toObject() : unit;
    return {
      ...plain,
      daysUntilExpiry: daysUntil(plain.expiryDate),
      expiryStatus: expiryStatus(plain),
    };
  });

  return {
    inventory: normalized,
    urgentNeed: normalized.filter((unit) => unit.status === 'critical' || unit.units <= 5 || unit.bloodType === 'O-'),
    expiring: normalized.filter((unit) => ['critical', 'use_soon'].includes(unit.expiryStatus)),
    donors,
    matching: donors,
    alerts: [
      { bloodType: 'O-', channel: 'SMS/WhatsApp', status: 'ready', message: 'Urgent O- broadcast ready for nearby donors' },
      { bloodType: 'A+', channel: 'SMS/WhatsApp', status: 'ready', message: 'Platelet donor broadcast ready' },
    ],
    bookingSlots: [
      { time: '09:00', demand: 'Quiet', fill: 32 },
      { time: '11:30', demand: 'Peak', fill: 88 },
      { time: '14:00', demand: 'Quiet', fill: 45 },
      { time: '17:30', demand: 'Peak', fill: 92 },
    ],
    patientRecords: normalized
      .filter((unit) => unit.source === 'blood_bank' && unit.patientRecord?.visibleToPatient !== false)
      .map((unit) => ({
        bloodBankName: unit.bloodBankName,
        bloodType: unit.bloodType,
        component: unit.component,
        collectionDate: unit.collectionDate,
        expiryDate: unit.expiryDate,
        shelfLifeDays: unit.shelfLifeDays,
        monthsValid: Number((unit.shelfLifeDays / 30).toFixed(1)),
        daysUntilExpiry: unit.daysUntilExpiry,
        hospital: unit.patientRecord?.hospital,
        issuedAt: unit.patientRecord?.issuedAt,
      })),
    predictedShortages: predictedShortages(normalized),
    privacyControls: {
      emergencySmsBroadcasts: true,
      whatsAppBroadcasts: true,
      shareWithHospitals: true,
      postDonationTracking: true,
    },
    languages: ['English', 'Hindi', 'Tamil', 'Telugu', 'Kannada'],
  };
}

router.get('/features', async (_req, res) => {
  try {
    if (!isDbReady()) return res.json(buildSnapshot(demoUnits));
    const units = await BloodUnit.find().sort({ expiryDate: 1 }).lean();
    const donors = await User.find({ role: 'donor' })
      .select('name bloodType phone status donations livesSaved location lastDonation')
      .limit(25)
      .lean();
    res.json(buildSnapshot(units.length ? units : demoUnits, donors.length ? donors : demoDonors));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/records', protect, adminOnly, async (_req, res) => {
  try {
    if (!isDbReady()) return res.status(503).json({ message: 'Database is not connected yet' });
    const units = await BloodUnit.find().sort({ expiryDate: 1 }).lean();
    res.json(buildSnapshot(units));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/records', protect, adminOnly, async (req, res) => {
  try {
    const {
      bloodBankName,
      bloodType,
      component,
      source,
      units,
      collectionDate,
      expiryDate,
      status,
      patientId,
      hospital,
      temperatureC,
      deviceId,
    } = req.body || {};

    if (!bloodType) return res.status(400).json({ message: 'Blood type is required' });

    if (!isDbReady()) {
      const record = {
        _id: `local-${Date.now()}`,
        bloodBankName: bloodBankName || req.user.bankName || req.user.hospitalName || req.user.name,
        bloodType,
        component: component || 'whole_blood',
        source: source || 'blood_bank',
        units: Math.max(1, Number(units) || 1),
        collectionDate: collectionDate ? new Date(collectionDate) : new Date(),
        expiryDate: expiryDate ? new Date(expiryDate) : new Date(Date.now() + 35 * MS_PER_DAY),
        status: status || 'available',
        patientRecord: {
          patientId,
          hospital,
          issuedAt: patientId || hospital ? new Date() : undefined,
          visibleToPatient: true,
        },
        coldChainLogs: [{
          temperatureC: temperatureC === '' || temperatureC === undefined ? undefined : Number(temperatureC),
          deviceId,
          status: 'safe',
        }],
      };

      return res.status(201).json({
        record,
        message: 'Blood record accepted in local demo mode. Connect MongoDB to persist records.',
      });
    }

    const record = await BloodUnit.create({
      bloodBankName: bloodBankName || req.user.bankName || req.user.hospitalName || req.user.name,
      bloodType,
      component: component || 'whole_blood',
      source: source || 'blood_bank',
      units: Math.max(1, Number(units) || 1),
      collectionDate: collectionDate ? new Date(collectionDate) : undefined,
      expiryDate: expiryDate ? new Date(expiryDate) : undefined,
      status: status || 'available',
      patientRecord: {
        patientId,
        hospital,
        issuedAt: patientId || hospital ? new Date() : undefined,
        visibleToPatient: true,
      },
      coldChainLogs: [{
        temperatureC: temperatureC === '' || temperatureC === undefined ? undefined : Number(temperatureC),
        deviceId,
        status: 'safe',
      }],
    });

    res.status(201).json({ record, message: 'Blood record created' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/patient-records/:patientId', async (req, res) => {
  try {
    const patientId = req.params.patientId;
    if (!isDbReady()) {
      return res.json({ patientId, records: buildSnapshot(demoUnits).patientRecords });
    }
    const units = await BloodUnit.find({ 'patientRecord.patientId': patientId, 'patientRecord.visibleToPatient': { $ne: false } }).lean();
    res.json({ patientId, records: buildSnapshot(units).patientRecords });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/eligibility/check', (req, res) => {
  const q = req.body || {};
  const reasons = [];
  if (Number(q.weightKg || 0) < 50) reasons.push('Weight must be at least 50 kg');
  if (q.recentTravel) reasons.push('Recent travel requires staff review');
  if (q.recentTattooOrPiercing) reasons.push('Recent tattoo or piercing may require deferral');
  if (q.currentMedication) reasons.push('Medication must be reviewed');
  res.json({ eligible: reasons.length === 0, reasons });
});

router.post('/alerts/emergency', async (req, res) => {
  const { bloodType = 'O-', radiusKm = 8, hospital = 'nearby hospital' } = req.body || {};
  res.json({
    bloodType,
    radiusKm,
    hospital,
    notified: demoDonors.filter((donor) => donor.bloodType === bloodType).map((donor) => ({
      donorId: donor._id,
      name: donor.name,
      channel: 'SMS/WhatsApp',
      status: 'queued',
    })),
  });
});

router.post('/donors/:id/usage', async (req, res) => {
  const { hospital = 'City Hospital', usedAt = new Date() } = req.body || {};
  res.json({
    donorId: req.params.id,
    hospital,
    usedAt,
    message: `Your blood saved a patient at ${hospital} today.`,
    notification: { status: 'queued', channel: 'push' },
  });
});

module.exports = router;
