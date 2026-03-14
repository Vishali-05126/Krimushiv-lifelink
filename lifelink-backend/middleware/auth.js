const jwt = require('jsonwebtoken');
<<<<<<< HEAD
const mongoose = require('mongoose');
const User = require('../models/User');
const fileAuthStore = require('../utils/fileAuthStore');

async function protect(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ message: 'Not authorized, token missing' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'lifelink-dev-secret');
    const user = mongoose.connection.readyState === 1
      ? await User.findById(decoded.id)
      : await fileAuthStore.findById(decoded.id);

    if (!user) {
      return res.status(401).json({ message: 'Not authorized, user not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Not authorized, token invalid' });
  }
}

function adminOnly(req, res, next) {
  if (req.user?.role === 'admin' || req.user?.role === 'hospital' || req.user?.role === 'bloodbank') {
    return next();
  }
  return res.status(403).json({ message: 'Admin access required' });
}
=======
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) return res.status(401).json({ message: 'Not authorized — no token' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user) return res.status(401).json({ message: 'User not found' });
    next();
  } catch {
    res.status(401).json({ message: 'Token invalid or expired' });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin')
    return res.status(403).json({ message: 'Admin access required' });
  next();
};
>>>>>>> 8d23fc7 (commit)

module.exports = { protect, adminOnly };
