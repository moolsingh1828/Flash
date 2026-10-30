import { Router } from 'express';
import {
  generateSubtitles,
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
videoRouter.get('/:id/subtitles', getSubtitles);
videoRouter.put('/:id/subtitles', saveSubtitles);
videoRouter.post('/:id/generate-subtitles', generateSubtitles);
videoRouter.patch('/:id', updateVideo);
videoRouter.get('/:id/stream', streamVideo);
videoRouter.get('/:id/progress', getProgress);
videoRouter.put('/:id/progress', updateProgress);