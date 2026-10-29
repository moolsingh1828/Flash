import { app } from './app.js';
import { connectDB } from './config/db.js';
import { ENV } from './config/env.js';
import { logger } from './utils/logger.js';

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection at:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

async function bootstrap() {
  const port = process.env.PORT || ENV.PORT || 5000;

  // Bind to 0.0.0.0 so Render detects the service is alive
  app.listen(port, '0.0.0.0', () => {
    logger.info(`Server operational on port ${port}`);
    console.log(`\n===============================================`);
    console.log(`Render Web Service listening on port ${port}`);
    console.log(`MONGODB_URI provided: ${Boolean(process.env.MONGODB_URI)}`);
    console.log(`TELEGRAM_API_ID provided: ${Boolean(process.env.TELEGRAM_API_ID)}`);
    console.log(`===============================================\n`);
  });

  // Attempt database connection in the background
  await connectDB();
}

bootstrap();