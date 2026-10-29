import { Router } from 'express';
import {
  cancelImport, disconnect, getChannels, getImportStatus, getStatus, startAuth, triggerImport, verify2FA, verifyCode
} from '../controllers/telegramController.js';
import { requireAuth } from '../middleware/auth.js';

export const telegramRouter = Router();
telegramRouter.use(requireAuth);
telegramRouter.get('/status', getStatus);
telegramRouter.post('/auth/start', startAuth);
telegramRouter.post('/auth/verify', verifyCode);
telegramRouter.post('/auth/2fa', verify2FA);
telegramRouter.get('/channels', getChannels);
telegramRouter.post('/import', triggerImport);
telegramRouter.get('/import/status/:jobId', getImportStatus);
telegramRouter.post('/import/cancel/:jobId', cancelImport);
telegramRouter.post('/disconnect', disconnect);
