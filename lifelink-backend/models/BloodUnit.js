const mongoose = require('mongoose');

const bloodUnitSchema = new mongoose.Schema(
  {
    bloodBankName: { type: String, default: 'LifeLink Central Blood Bank' },
    bloodType: { type: String, required: true },
    component: {
      type: String,
      enum: ['whole_blood', 'red_cells', 'plasma', 'platelets'],
      default: 'whole_blood',
    },
    source: { type: String, enum: ['donor', 'blood_bank'], default: 'blood_bank' },
    units: { type: Number, default: 1 },
    collectionDate: Date,
    expiryDate: Date,
    shelfLifeDays: Number,
    status: { type: String, enum: ['available', 'low', 'critical', 'reserved', 'expired'], default: 'available' },
    patientRecord: {
      patientId: String,
      hospital: String,
      issuedAt: Date,
      usedAt: Date,
      visibleToPatient: { type: Boolean, default: true },
    },
    coldChainLogs: [
      {
        temperatureC: Number,
        deviceId: String,
        status: { type: String, enum: ['safe', 'warning', 'breach'], default: 'safe' },
        recordedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

const shelfLife = {
  whole_blood: 35,
  red_cells: 42,
  plasma: 365,
  platelets: 5,
};

bloodUnitSchema.pre('validate', function setExpiry(next) {
  if (!this.shelfLifeDays) this.shelfLifeDays = shelfLife[this.component] || 35;
  if (!this.collectionDate) this.collectionDate = new Date();
  if (!this.expiryDate) {
    this.expiryDate = new Date(this.collectionDate.getTime() + this.shelfLifeDays * 24 * 60 * 60 * 1000);
  }
  next();
});

module.exports = mongoose.model('BloodUnit', bloodUnitSchema);
