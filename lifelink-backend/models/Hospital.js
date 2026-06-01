const mongoose = require('mongoose');

const hospitalSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    address: String,
    phone: String,
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [0, 0] },
      city: String,
    },
    isOpen: { type: Boolean, default: true },
    openHours: String,
    bedsAvailable: { type: Number, default: 0 },
    doctorsOnDuty: { type: Number, default: 0 },
    hasBloodBank: { type: Boolean, default: true },
    hasOrganFacility: { type: Boolean, default: false },
    isTraumaCentre: { type: Boolean, default: false },
    acceptingDonors: { type: Boolean, default: true },
    bloodStock: { type: Map, of: Number, default: {} },
    rating: { type: Number, default: 4.5 },
  },
  { timestamps: true }
);

hospitalSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Hospital', hospitalSchema);
