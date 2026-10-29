import { Router } from 'express';
import { login, register, logout, me } from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';

export const authRouter = Router();
authRouter.post('/login', login);
authRouter.post('/register', register);
authRouter.post('/logout', logout);
authRouter.get('/me', requireAuth, me);