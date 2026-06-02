const mongoose = require('mongoose');

const recordingSchema = new mongoose.Schema({
  type:        { type: String, enum: ['continuous', 'animal_detected'], required: true },
  zone:        { type: String, required: true },
  videoUrl:    { type: String },             // Cloudinary URL
  thumbnailUrl:{ type: String },             // Cloudinary thumbnail
  duration:    { type: Number },             // seconds
  fileSize:    { type: Number },             // bytes
  detectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Detection' }, // linked detection if type=animal_detected
  startTime:   { type: Date, default: Date.now },
  endTime:     { type: Date }
});

module.exports = mongoose.model('Recording', recordingSchema);
