const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const pointSchema = {
  type: { type: String, enum: ['Point'], default: 'Point' },
  coordinates: { type: [Number], default: [0, 0] },
  city: String,
  address: String,
};

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['admin', 'donor', 'receiver', 'hospital', 'bloodbank'], default: 'donor' },
    phone: String,
    isVerified: { type: Boolean, default: false },
    verifiedBadge: { type: Boolean, default: false },
    location: pointSchema,
    bloodType: String,
    donations: { type: Number, default: 0 },
    trustScore: { type: Number, default: 85 },
    livesSaved: { type: Number, default: 0 },
    isAvailable: { type: Boolean, default: true },
    status: { type: String, enum: ['available', 'busy', 'offline'], default: 'available' },
    organDonor: { type: Boolean, default: false },
    organsPledged: [String],
    lastDonation: Date,
    dateOfBirth: Date,
    gender: String,
    weight: Number,
    medicalConditions: String,
    diseases: [String],
    hemoglobin: Number,
    healthScore: Number,
    requiredBloodType: String,
    urgency: String,
    medicalCondition: String,
    attendingHospital: String,
    guardianName: String,
    guardianPhone: String,
    hospitalName: String,
    registrationNumber: String,
    hospitalType: String,
    bedCount: Number,
    hasBloodBank: { type: Boolean, default: false },
    hasOrganFacility: { type: Boolean, default: false },
    isTraumaCentre: { type: Boolean, default: false },
    contactPerson: String,
    website: String,
    bankName: String,
    licenseNumber: String,
    bankType: String,
    storageCapacity: Number,
    bloodStock: { type: Map, of: Number, default: {} },
    acceptingDonors: { type: Boolean, default: true },
    operatingHours: String,
  },
  { timestamps: true }
);

userSchema.index({ location: '2dsphere' });

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.matchPassword = function matchPassword(password) {
  return bcrypt.compare(password, this.password);
};

module.exports = mongoose.model('User', userSchema);
