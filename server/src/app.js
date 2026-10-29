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

app.set('trust proxy', 1);

// Configure Helmet to allow cross-origin media streaming
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  })
);

// Global header: Ensure browser never blocks media or API calls across Render domains
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
});

app.use(
  cors({
    origin: (origin, callback) => callback(null, true),
    credentials: true
  })
);

app.use(express.json());
app.use(cookieParser());

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true
});

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

// Main API routes
app.use('/api/auth', authRouter);
app.use('/api/telegram', telegramRouter);
app.use('/api/courses', courseRouter);
app.use('/api/folders', folderRouter);
app.use('/api/videos', videoRouter);

// Fallback route: in case a request arrives at /videos instead of /api/videos
app.use('/videos', videoRouter);

app.use(errorHandler);