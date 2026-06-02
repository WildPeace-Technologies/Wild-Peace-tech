const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) return res.status(401).json({ message: 'Not authorized' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token invalid' });
  }
};

const officerOnly = (req, res, next) => {
  if (req.user && req.user.role === 'officer') return next();
  res.status(403).json({ message: 'Officer access only' });
};

// ESP32 API key check
const esp32Auth = (req, res, next) => {
  const key = req.headers['x-api-key'];
  if (key === process.env.ESP32_API_KEY) return next();
  res.status(401).json({ message: 'Invalid API key' });
};

module.exports = { protect, officerOnly, esp32Auth };
