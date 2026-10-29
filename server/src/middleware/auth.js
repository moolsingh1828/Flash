import jwt from 'jsonwebtoken';
import { ENV } from '../config/env.js';
import { User } from '../models/User.js';

export async function requireAuth(req, res, next) {
  try {
    const token =
      req.cookies?.token ||
      req.headers.authorization?.split(' ')[1] ||
      req.query?.token;

    if (token) {
      const decoded = jwt.verify(token, ENV.JWT_SECRET);
      const user = await User.findById(decoded.userId).select('-password');
      if (user) {
        req.user = user;
        return next();
      }
    }

    // Fallback for media streaming: video tags cannot send Authorization headers,
    // so fall back to the owner's authorized Telegram session
    if (req.path.includes('/stream')) {
      const defaultUser = await User.findOne({ encryptedTelegramSession: { $ne: null } });
      if (defaultUser) {
        req.user = defaultUser;
        return next();
      }
    }

    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  } catch (err) {
    if (req.path.includes('/stream')) {
      const defaultUser = await User.findOne({ encryptedTelegramSession: { $ne: null } });
      if (defaultUser) {
        req.user = defaultUser;
        return next();
      }
    }
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
}