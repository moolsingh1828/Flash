import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { ENV } from './config/env.js';
import { dbStatus } from './config/db.js';
import { authRouter } from './routes/authRoutes.js';
import { courseRouter } from './routes/courseRoutes.js';
import { folderRouter } from './routes/folderRoutes.js';
import { videoRouter } from './routes/videoRoutes.js';
import { telegramRouter } from './routes/telegramRoutes.js';
import { errorHandler } from './middleware/error.js';

export const app = express();

// Trust Render's reverse proxy for HTTPS headers
app.set('trust proxy', 1);

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow Render frontend, localhost, or requests with no origin (like mobile/Postman)
      callback(null, true);
    },
    credentials: true
  })
);

app.use(express.json());
app.use(cookieParser());

// Rate limiter for API routes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true
});

// Live Health & Diagnostics Route for Render
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    database: dbStatus.connected ? 'connected' : 'error',
    databaseDetails: dbStatus.error || 'Connected to MongoDB Atlas',
    environmentCheck: {
      hasTelegramId: Boolean(process.env.TELEGRAM_API_ID),
      hasTelegramHash: Boolean(process.env.TELEGRAM_API_HASH),
      hasJwtSecret: Boolean(process.env.JWT_SECRET),
      hasSessionKey: Boolean(process.env.SESSION_ENCRYPTION_KEY)
    }
  });
});

app.use('/api', apiLimiter);

// Application API routes
app.use('/api/auth', authRouter);
app.use('/api/telegram', telegramRouter);
app.use('/api/courses', courseRouter);
app.use('/api/folders', folderRouter);
app.use('/api/videos', videoRouter);

// Global Error Handler
app.use(errorHandler);