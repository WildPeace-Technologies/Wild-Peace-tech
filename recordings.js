const express = require('express');
const router = express.Router();
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const Recording = require('../models/Recording');
const { protect, esp32Auth } = require('../middleware/auth');

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB max

// POST /api/recordings/upload  — ESP32-CAM uploads video
router.post('/upload', esp32Auth, upload.single('video'), async (req, res) => {
  try {
    const { type, zone, duration, detectionId } = req.body;

    // Upload to Cloudinary
    const uploadResult = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { resource_type: 'video', folder: `wildlife/${type}`, eager: [{ format: 'jpg', transformation: [{ start_offset: '0' }] }] },
        (err, result) => { if (err) reject(err); else resolve(result); }
      ).end(req.file.buffer);
    });

    const recording = await Recording.create({
      type, zone, duration: Number(duration),
      videoUrl:     uploadResult.secure_url,
      thumbnailUrl: uploadResult.eager?.[0]?.secure_url || '',
      fileSize:     req.file.size,
      detectionId:  detectionId || null,
      endTime:      new Date()
    });

    res.status(201).json(recording);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/recordings
router.get('/', protect, async (req, res) => {
  try {
    const { type, zone, page = 1, limit = 12 } = req.query;
    const filter = {};
    if (type) filter.type = type;
    if (zone) filter.zone = zone;
    if (req.user.role === 'owner') filter.zone = req.user.zone;

    const total = await Recording.countDocuments(filter);
    const recordings = await Recording.find(filter)
      .populate('detectionId')
      .sort({ startTime: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({ recordings, total, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/recordings/:id  — officer only
router.delete('/:id', protect, async (req, res) => {
  try {
    if (req.user.role !== 'officer')
      return res.status(403).json({ message: 'Officer access only' });
    const rec = await Recording.findByIdAndDelete(req.params.id);
    if (!rec) return res.status(404).json({ message: 'Not found' });
    // Delete from Cloudinary
    const publicId = rec.videoUrl.split('/').slice(-2).join('/').split('.')[0];
    await cloudinary.uploader.destroy(publicId, { resource_type: 'video' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
