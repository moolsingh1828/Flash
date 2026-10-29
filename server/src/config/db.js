import mongoose from 'mongoose';
import { ENV } from './env.js';
import { logger } from '../utils/logger.js';

export const dbStatus = {
  connected: false,
  error: null
};

export async function connectDB() {
  const uri = process.env.MONGODB_URI || ENV.MONGODB_URI;

  if (!uri || uri.includes('127.0.0.1') || uri.includes('localhost')) {
    const msg = 'MONGODB_URI is pointing to localhost (127.0.0.1). Add your MongoDB Atlas connection string in Render Environment Variables!';
    console.error('\n==================================================');
    console.error('DATABASE CONFIGURATION ERROR:');
    console.error(msg);
    console.error('==================================================\n');
    dbStatus.error = msg;
    return;
  }

  if (uri.includes('<password>')) {
    const msg = 'MONGODB_URI still contains "<password>"! Replace "<password>" with your actual MongoDB Atlas database password.';
    console.error('\n==================================================');
    console.error('DATABASE CONFIGURATION ERROR:');
    console.error(msg);
    console.error('==================================================\n');
    dbStatus.error = msg;
    return;
  }

  try {
    await mongoose.connect(uri);
    dbStatus.connected = true;
    dbStatus.error = null;
    logger.info('Connected to MongoDB database');
    console.log('✓ Successfully connected to MongoDB Atlas!');
  } catch (err) {
    dbStatus.connected = false;
    dbStatus.error = err.message;
    console.error('\n==================================================');
    console.error('FAILED TO CONNECT TO MONGODB ATLAS:');
    console.error(err.message);
    console.error('Hint: Make sure 0.0.0.0/0 is added in MongoDB Atlas -> Network Access!');
    console.error('==================================================\n');
  }
}