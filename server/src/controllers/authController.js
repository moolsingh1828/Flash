import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { loginSchema } from '../validators/schemas.js';
import { ENV } from '../config/env.js';

export async function login(req, res, next) {
  try {
    const data = loginSchema.parse(req.body);
    let user = await User.findOne({ email: data.email.toLowerCase() });

    const userCount = await User.countDocuments();
    if (userCount === 0) {
      user = await User.create({ email: data.email.toLowerCase(), password: data.password });
    } else if (!user) {
      return res.status(401).json({ error: 'User does not exist with this email.' });
    } else {
      const matches = await user.comparePassword(data.password);
      if (!matches) {
        return res.status(401).json({ error: 'Incorrect password.' });
      }
    }

    const token = jwt.sign({ userId: user._id }, ENV.JWT_SECRET, { expiresIn: '7d' });
    const isProduction = process.env.NODE_ENV === 'production';

    res.cookie('token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({
      message: 'Login successful',
      token,
      user: { id: user._id, email: user.email, hasTelegram: !!user.encryptedTelegramSession }
    });
  } catch (err) {
    next(err);
  }
}

export async function register(req, res, next) {
  try {
    const data = loginSchema.parse(req.body);
    const existing = await User.findOne({ email: data.email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ error: 'An account with this email already exists.' });
    }

    const user = await User.create({ email: data.email.toLowerCase(), password: data.password });
    const token = jwt.sign({ userId: user._id }, ENV.JWT_SECRET, { expiresIn: '7d' });
    const isProduction = process.env.NODE_ENV === 'production';

    res.cookie('token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.status(201).json({
      message: 'Account created successfully',
      token,
      user: { id: user._id, email: user.email, hasTelegram: false }
    });
  } catch (err) {
    next(err);
  }
}

export function logout(req, res) {
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully' });
}

export function me(req, res) {
  res.json({
    user: {
      id: req.user._id,
      email: req.user.email,
      hasTelegram: !!req.user.encryptedTelegramSession,
      phone: req.user.telegramPhoneNumber
    }
  });
}
