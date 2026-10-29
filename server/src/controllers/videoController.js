import { Video } from '../models/Video.js';
import { WatchProgress } from '../models/WatchProgress.js';
import { streamVideoFromTelegram } from '../services/telegram/mediaService.js';
import { progressUpdateSchema, videoUpdateSchema } from '../validators/schemas.js';

export async function getVideos(req, res, next) {
  try {
    const { unorganized, search } = req.query;
    const filter = {};
    if (unorganized === 'true') filter.courseId = null;
    if (search) filter.$text = { $search: search };

    const videos = await Video.find(filter).sort({ createdAt: -1 });
    res.json(videos);
  } catch (err) {
    next(err);
  }
}

export async function getVideoById(req, res, next) {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) return res.status(404).json({ error: 'Video not found' });
    const progress = await WatchProgress.findOne({ videoId: video._id });
    res.json({ video, progress: progress || { positionSeconds: 0, completed: false } });
  } catch (err) {
    next(err);
  }
}

export async function updateVideo(req, res, next) {
  try {
    const data = videoUpdateSchema.parse(req.body);
    const video = await Video.findByIdAndUpdate(req.params.id, data, { new: true });
    if (!video) return res.status(404).json({ error: 'Video not found' });
    res.json(video);
  } catch (err) {
    next(err);
  }
}

export async function streamVideo(req, res) {
  await streamVideoFromTelegram(req, res, req.user);
}

export async function getProgress(req, res, next) {
  try {
    const progress = await WatchProgress.findOne({ videoId: req.params.id });
    res.json(progress || { positionSeconds: 0, completed: false });
  } catch (err) {
    next(err);
  }
}

export async function updateProgress(req, res, next) {
  try {
    const data = progressUpdateSchema.parse(req.body);
    const progress = await WatchProgress.findOneAndUpdate(
      { videoId: req.params.id },
      { positionSeconds: data.positionSeconds, completed: data.completed ?? false, lastWatchedAt: new Date() },
      { upsert: true, new: true }
    );
    res.json(progress);
  } catch (err) {
    next(err);
  }
}

export async function getRecentWatched(req, res, next) {
  try {
    const list = await WatchProgress.find().sort({ lastWatchedAt: -1 }).limit(10).populate('videoId');
    res.json(list.filter(p => p.videoId));
  } catch (err) {
    next(err);
  }
}
