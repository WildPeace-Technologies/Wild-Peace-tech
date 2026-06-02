const mongoose = require('mongoose');

const detectionSchema = new mongoose.Schema({
  type:       { type: String, enum: ['ANIMAL', 'HUMAN', 'VEHICLE', 'UNKNOWN'], required: true },
  zone:       { type: String, required: true },
  confidence: { type: Number },              // 0.0 - 1.0
  imageUrl:   { type: String },              // Cloudinary URL of snapshot
  sensors: {
    pir:      { type: Boolean },
    radar:    { type: Boolean },
    distance: { type: Number }               // cm
  },
  notified:   { type: Boolean, default: false },
  timestamp:  { type: Date, default: Date.now }
});

module.exports = mongoose.model('Detection', detectionSchema);
