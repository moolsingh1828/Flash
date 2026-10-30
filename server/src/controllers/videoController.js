import path from 'path';
import fs from 'fs';
import { Video } from '../models/Video.js';
import { WatchProgress } from '../models/WatchProgress.js';
import { streamVideoFromTelegram, getVideoDownloadStatus } from '../services/telegram/mediaService.js';
import { generateSubtitlesWithGroq } from '../services/subtitleService.js';
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
    res.json(list.filter((p) => p.videoId));
  } catch (err) {
    next(err);
  }
}

export function getVideoStatus(req, res) {
  const { id } = req.params;
  const status = getVideoDownloadStatus(id);
  res.json(status);
}

export async function getSubtitles(req, res, next) {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) return res.status(404).json({ error: 'Video not found' });
    res.json({ subtitles: video.subtitles || null });
  } catch (err) {
    next(err);
  }
}

export async function saveSubtitles(req, res, next) {
  try {
    const { subtitles } = req.body;
    const video = await Video.findByIdAndUpdate(
      req.params.id,
      { $set: { subtitles, updatedAt: new Date() } },
      { new: true }
    );
    if (!video) return res.status(404).json({ error: 'Video not found' });
    res.json({ message: 'Subtitles saved successfully', subtitles: video.subtitles });
  } catch (err) {
    next(err);
  }
}

export async function generateSubtitles(req, res, next) {
  try {
    const { id } = req.params;
    const video = await Video.findById(id);
    if (!video) return res.status(404).json({ error: 'Video not found' });

    if (video.subtitles && video.subtitles.trim().length > 30) {
      return res.json({
        message: 'Subtitles already exist in database',
        subtitles: video.subtitles
      });
    }

    const cacheFilePath = path.join(process.cwd(), 'media_cache', `${video._id}.mp4`);
    const partFilePath = path.join(process.cwd(), 'media_cache', `${video._id}.mp4.part`);

    const targetFile = fs.existsSync(cacheFilePath)
      ? cacheFilePath
      : fs.existsSync(partFilePath) && fs.statSync(partFilePath).size > 2 * 1024 * 1024
        ? partFilePath
        : null;

    if (!targetFile) {
      return res.status(400).json({
        error: 'Video is not yet buffered on server. Please click Play for 2 seconds first so audio can be extracted.'
      });
    }

    const vtt = await generateSubtitlesWithGroq(targetFile);

    video.subtitles = vtt;
    await video.save();

    res.json({
      message: 'Subtitles generated and saved successfully',
      subtitles: vtt
    });
  } catch (err) {
    next(err);
  }
}