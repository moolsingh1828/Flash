import mongoose from 'mongoose';
import { ENV } from './env.js';
import { logger } from '../utils/logger.js';

export async function connectDB() {
  try {
    await mongoose.connect(ENV.MONGODB_URI);
    logger.info('Connected to MongoDB database');
  } catch (err) {
    logger.error({ err }, 'MongoDB connection error');
    process.exit(1);
  }
}
