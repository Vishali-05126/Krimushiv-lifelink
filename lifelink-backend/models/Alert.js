const mongoose = require('mongoose');

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
