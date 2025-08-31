// backend/middleware/auth.middleware.js
const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  try {
    const header = req.headers['authorization'] || req.headers['Authorization'] || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : header;

    if (!token) {
      return res.status(401).json({ message: 'Token manquant' });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ message: 'Token invalide ou expiré' });
  }
};
