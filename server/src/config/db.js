import mongoose from 'mongoose';
import { ENV } from './env.js';
import { logger } from '../utils/logger.js';

export async function connectDB() {
  try {
    if (!ENV.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is missing on Render!');
    }
    await mongoose.connect(ENV.MONGODB_URI);
    logger.info('Connected to MongoDB database');
  } catch (err) {
    console.error('CRITICAL DATABASE ERROR:', err.message);
    process.exit(1);
  }
}