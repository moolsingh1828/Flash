import { Router } from 'express';
import { createFolder, deleteFolder, updateFolder } from '../controllers/folderController.js';
import { requireAuth } from '../middleware/auth.js';

export const folderRouter = Router();
folderRouter.use(requireAuth);
folderRouter.post('/', createFolder);
folderRouter.patch('/:id', updateFolder);
folderRouter.delete('/:id', deleteFolder);
