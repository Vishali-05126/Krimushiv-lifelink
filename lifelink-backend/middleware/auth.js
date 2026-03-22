const jwt = require('jsonwebtoken');
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

module.exports = { protect, adminOnly };
