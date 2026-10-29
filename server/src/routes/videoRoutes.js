import { Router } from 'express';
import {
  getProgress,
  getRecentWatched,
  getSubtitles,
  getVideoById,
  getVideos,
  getVideoStatus,
  saveSubtitles,
  streamVideo,
  updateProgress,
  updateVideo
} from '../controllers/videoController.js';
import { requireAuth } from '../middleware/auth.js';

export const videoRouter = Router();
videoRouter.use(requireAuth);

videoRouter.get('/', getVideos);
videoRouter.get('/recent', getRecentWatched);
videoRouter.get('/:id', getVideoById);
videoRouter.get('/:id/status', getVideoStatus);
videoRouter.get('/:id/subtitles', getSubtitles);     // <-- Get subtitles
videoRouter.put('/:id/subtitles', saveSubtitles);     // <-- Save auto-generated subtitles
videoRouter.patch('/:id', updateVideo);
videoRouter.get('/:id/stream', streamVideo);
videoRouter.get('/:id/progress', getProgress);
videoRouter.put('/:id/progress', updateProgress);