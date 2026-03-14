const mongoose = require('mongoose');

<<<<<<< HEAD
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
=======
const HospitalSchema = new mongoose.Schema({
  name:     { type: String, required: true },
  address:  { type: String, required: true },
  phone:    { type: String },
  email:    { type: String },
  website:  { type: String },
  location: {
    type:        { type: String, default: 'Point' },
    coordinates: { type: [Number], required: true }, // [lng, lat]
    city:        { type: String },
    state:       { type: String },
  },

  // Live status
  isOpen:         { type: Boolean, default: true },
  openHours:      { type: String, default: '24/7' },
  bedsAvailable:  { type: Number, default: 0 },
  doctorsOnDuty:  { type: Number, default: 0 },

  // Capabilities
  hasBloodBank:     { type: Boolean, default: false },
  hasOrganFacility: { type: Boolean, default: false },
  isTraumaCentre:   { type: Boolean, default: false },
  acceptingDonors:  { type: Boolean, default: true },

  // Blood stock
  bloodStock: {
    'A+':  { type: Number, default: 0 },
    'A-':  { type: Number, default: 0 },
    'B+':  { type: Number, default: 0 },
    'B-':  { type: Number, default: 0 },
    'AB+': { type: Number, default: 0 },
    'AB-': { type: Number, default: 0 },
    'O+':  { type: Number, default: 0 },
    'O-':  { type: Number, default: 0 },
  },

  rating:    { type: Number, default: 4.0 },
  updatedAt: { type: Date, default: Date.now },
});

HospitalSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Hospital', HospitalSchema);
>>>>>>> 8d23fc7 (commit)
