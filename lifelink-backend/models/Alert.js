const mongoose = require('mongoose');

<<<<<<< HEAD
const alertSchema = new mongoose.Schema(
  {
    type: { type: String, default: 'blood_request' },
    severity: { type: String, enum: ['critical', 'warning', 'info', 'success'], default: 'info' },
    title: String,
    message: String,
    bloodType: String,
    unitsNeeded: { type: Number, default: 1 },
    hospital: {
      name: String,
      address: String,
      location: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], default: [0, 0] },
      },
    },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    acceptedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['open', 'accepted', 'rejected', 'fulfilled', 'cancelled'], default: 'open' },
    expiresAt: { type: Date, default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) },
  },
  { timestamps: true }
);

alertSchema.index({ 'hospital.location': '2dsphere' });

module.exports = mongoose.model('Alert', alertSchema);
=======
const AlertSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['blood_request', 'organ_match', 'low_stock', 'hospital_update', 'mission_complete'],
    required: true,
  },
  severity:    { type: String, enum: ['critical', 'warning', 'info', 'success'], default: 'info' },
  title:       { type: String, required: true },
  message:     { type: String, required: true },
  bloodType:   { type: String },
  unitsNeeded: { type: Number, default: 1 },

  hospital: {
    name:    { type: String },
    address: { type: String },
    location: {
      type:        { type: String, default: 'Point' },
      coordinates: { type: [Number] }, // [lng, lat]
    },
  },

  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  acceptedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  status:     { type: String, enum: ['open', 'accepted', 'fulfilled', 'expired'], default: 'open' },
  expiresAt:  { type: Date, default: () => new Date(Date.now() + 2 * 60 * 60 * 1000) }, // 2 hours
  createdAt:  { type: Date, default: Date.now },
});

AlertSchema.index({ 'hospital.location': '2dsphere' });
AlertSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Alert', AlertSchema);
>>>>>>> 8d23fc7 (commit)
