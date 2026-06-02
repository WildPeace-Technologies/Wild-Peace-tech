const express = require('express');
const router = express.Router();
const Detection = require('../models/Detection');
const User = require('../models/User');
const { protect, esp32Auth } = require('../middleware/auth');
let admin; // Firebase admin - loaded lazily
try { admin = require('firebase-admin'); } catch(e) {}

// Send Firebase push notification
async function sendPush(tokens, title, body, data = {}) {
  if (!admin || !tokens.length) return;
  try {
    await admin.messaging().sendEachForMulticast({
      tokens, notification: { title, body }, data,
      android: { priority: 'high' }
    });
  } catch (err) {
    console.error('Push error:', err.message);
  }
}

// POST /api/detections  — called by ESP32
router.post('/', esp32Auth, async (req, res) => {
  try {
    const { type, zone, confidence, imageUrl, sensors } = req.body;
    const detection = await Detection.create({ type, zone, confidence, imageUrl, sensors });

    // Push notification to all officers + owners
    if (type === 'ANIMAL') {
      const users = await User.find({ fcmToken: { $exists: true, $ne: null } });
      const tokens = users.map(u => u.fcmToken).filter(Boolean);
      await sendPush(
        tokens,
        '🦁 Wildlife Alert!',
        `Animal detected at ${zone}`,
        { detectionId: detection._id.toString(), zone }
      );
      await Detection.findByIdAndUpdate(detection._id, { notified: true });
    }

    res.status(201).json(detection);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/detections  — dashboard
router.get('/', protect, async (req, res) => {
  try {
    const { type, zone, from, to, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (type)  filter.type = type;
    if (zone)  filter.zone = zone;
    if (from || to) {
      filter.timestamp = {};
      if (from) filter.timestamp.$gte = new Date(from);
      if (to)   filter.timestamp.$lte = new Date(to);
    }
    // Owners see only their zone
    if (req.user.role === 'owner') filter.zone = req.user.zone;

    const total = await Detection.countDocuments(filter);
    const detections = await Detection.find(filter)
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({ detections, total, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/detections/stats
router.get('/stats', protect, async (req, res) => {
  try {
    const zoneFilter = req.user.role === 'owner' ? { zone: req.user.zone } : {};

    const [total, animals, humans, vehicles, todayCount] = await Promise.all([
      Detection.countDocuments(zoneFilter),
      Detection.countDocuments({ ...zoneFilter, type: 'ANIMAL' }),
      Detection.countDocuments({ ...zoneFilter, type: 'HUMAN' }),
      Detection.countDocuments({ ...zoneFilter, type: 'VEHICLE' }),
      Detection.countDocuments({
        ...zoneFilter,
        timestamp: { $gte: new Date(new Date().setHours(0,0,0,0)) }
      })
    ]);

    // Last 7 days chart data
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const daily = await Detection.aggregate([
      { $match: { ...zoneFilter, timestamp: { $gte: sevenDaysAgo } } },
      { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
        count: { $sum: 1 },
        animals: { $sum: { $cond: [{ $eq: ['$type', 'ANIMAL'] }, 1, 0] } }
      }},
      { $sort: { _id: 1 } }
    ]);

    res.json({ total, animals, humans, vehicles, todayCount, daily });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
