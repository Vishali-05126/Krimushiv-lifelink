const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const dataDir = path.join(__dirname, '..', 'data');
const usersPath = path.join(dataDir, 'users.json');

async function readUsers() {
  try {
    const raw = await fs.readFile(usersPath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

async function writeUsers(users) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(usersPath, JSON.stringify(users, null, 2));
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function toUserDocument(user) {
  return {
    ...user,
    id: user._id,
    matchPassword: (password) => bcrypt.compare(password, user.password),
  };
}

async function findByEmail(email) {
  const users = await readUsers();
  const user = users.find((item) => item.email === normalizeEmail(email));
  return user ? toUserDocument(user) : null;
}

async function findById(id) {
  const users = await readUsers();
  const user = users.find((item) => item._id === id || item.id === id);
  return user ? toUserDocument(user) : null;
}

async function updateById(id, updates) {
  const users = await readUsers();
  const index = users.findIndex((item) => item._id === id || item.id === id);
  if (index === -1) return null;

  users[index] = {
    ...users[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  await writeUsers(users);
  return toUserDocument(users[index]);
}

async function recordAcceptedDonation(id, opts = {}) {
  const user = await findById(id);
  if (!user) return null;

  return updateById(id, {
    donations: Number(user.donations || 0) + Number(opts.donationsToAdd || 1),
    livesSaved: Number(user.livesSaved || 0) + Number(opts.livesSavedToAdd || 3),
    lastDonation: opts.donationDate || new Date().toISOString(),
    status: 'busy',
    isAvailable: false,
  });
}

async function create(userData) {
  const users = await readUsers();
  const email = normalizeEmail(userData.email);
  if (users.some((item) => item.email === email)) {
    const err = new Error('Email already registered');
    err.code = 'DUPLICATE_EMAIL';
    throw err;
  }

  const now = new Date().toISOString();
  const user = {
    ...userData,
    _id: crypto.randomUUID(),
    email,
    password: await bcrypt.hash(userData.password, 10),
    isVerified: false,
    verifiedBadge: false,
    donations: userData.donations || 0,
    livesSaved: userData.livesSaved || 0,
    isAvailable: userData.isAvailable !== false,
    status: userData.status || 'available',
    bloodStock: userData.bloodStock || {},
    acceptingDonors: userData.acceptingDonors !== false,
    createdAt: now,
    updatedAt: now,
  };

  users.push(user);
  await writeUsers(users);
  return toUserDocument(user);
}

module.exports = {
  create,
  findByEmail,
  findById,
  updateById,
  recordAcceptedDonation,
};
