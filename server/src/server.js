import { app } from './app.js';
import { connectDB } from './config/db.js';
import { ENV } from './config/env.js';
import { logger } from './utils/logger.js';

async function bootstrap() {
  await connectDB();
  const port = process.env.PORT || ENV.PORT || 5000;
  app.listen(port, '0.0.0.0', () => {
    logger.info(`Server operational on port ${port}`);
  });
}

bootstrap();