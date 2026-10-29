import dotenv from 'dotenv';
dotenv.config();

export const ENV = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/telegram_course_library',
  JWT_SECRET: process.env.JWT_SECRET || 'fallback_secret_must_change_in_production_32char',
  SESSION_ENCRYPTION_KEY: process.env.SESSION_ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  TELEGRAM_API_ID: parseInt(process.env.TELEGRAM_API_ID, 10),
  TELEGRAM_API_HASH: process.env.TELEGRAM_API_HASH,
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173'
};
