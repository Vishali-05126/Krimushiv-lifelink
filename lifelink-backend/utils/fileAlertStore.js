const fs = require('fs/promises');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const alertsPath = path.join(dataDir, 'alerts.json');

const defaultAlerts = [
  {
    _id: 'demo-alert-o-pos',
    type: 'blood_request',
    severity: 'critical',
    title: 'O+ blood needed for emergency surgery',
    message: 'St. Mary Hospital needs O+ blood for an emergency surgery.',
    bloodType: 'O+',
    unitsNeeded: 2,
    status: 'open',
    hospital: {
      name: 'St. Mary Hospital',
      address: 'Anna Salai, Chennai',
      location: { type: 'Point', coordinates: [80.2707, 13.0827] },
    },
    reason: 'Emergency Surgery',
    distanceKm: 2.3,
    expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
  },
  {
    _id: 'demo-alert-a-pos',
    type: 'blood_request',
    severity: 'urgent',
    title: 'A+ donor requested',
    message: 'City General needs A+ blood for post-op care.',
    bloodType: 'A+',
    unitsNeeded: 1,
    status: 'open',
    hospital: {
      name: 'City General',
      address: 'T. Nagar, Chennai',
      location: { type: 'Point', coordinates: [80.2341, 13.0418] },
    },
    reason: 'Post-op Care',
    distanceKm: 4.1,
    expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
  },
  {
    _id: 'demo-alert-o-neg',
    type: 'blood_request',
    severity: 'critical',
    title: 'O- trauma request',
    message: 'Apollo Hospitals needs O- blood for a trauma case.',
    bloodType: 'O-',
    unitsNeeded: 3,
    status: 'open',
    hospital: {
      name: 'Apollo Hospitals',
      address: 'Greams Road, Chennai',
      location: { type: 'Point', coordinates: [80.2565, 13.062] },
    },
    reason: 'Trauma Accident',
    distanceKm: 5.6,
    expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
  },
];

async function readAlerts() {
  try {
    const raw = await fs.readFile(alertsPath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return defaultAlerts;
    throw err;
  }
}

async function writeAlerts(alerts) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(alertsPath, JSON.stringify(alerts, null, 2));
}

function compatible(alertBloodType, donorBloodType) {
  return alertBloodType === donorBloodType || donorBloodType === 'O-' || alertBloodType === 'O-';
}

async function listForDonor(user, query = {}) {
  const alerts = await readAlerts();
  return alerts
    .filter((alert) => alert.status === 'open')
    .filter((alert) => !query.bloodType || compatible(alert.bloodType, query.bloodType))
    .filter((alert) => !user?.bloodType || compatible(alert.bloodType, user.bloodType))
    .sort((a, b) => String(a.severity).localeCompare(String(b.severity)));
}

async function mark(id, status, user) {
  const alerts = await readAlerts();
  const index = alerts.findIndex((alert) => alert._id === id || alert.id === id);
  if (index === -1) return null;

  alerts[index] = {
    ...alerts[index],
    status,
    acceptedBy: status === 'accepted' ? user?._id || user?.id : alerts[index].acceptedBy,
    rejectedBy: status === 'rejected' ? user?._id || user?.id : alerts[index].rejectedBy,
    updatedAt: new Date().toISOString(),
  };
  await writeAlerts(alerts);
  return alerts[index];
}

module.exports = {
  listForDonor,
  mark,
};
