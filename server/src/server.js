import { app } from './app.js';
import { connectDB } from './config/db.js';
import { ENV } from './config/env.js';
import { logger } from './utils/logger.js';

export const app = express();
app.set('trust proxy', 1); // Required for Render HTTPS proxies

async function bootstrap() {
  await connectDB();
  app.listen(ENV.PORT, () => {
    logger.info(`Server operational on http://localhost:${ENV.PORT}`);
  });
}
bootstrap();
