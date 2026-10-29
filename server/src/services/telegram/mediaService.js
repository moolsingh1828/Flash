import fs from 'fs';
import path from 'path';
import { getTelegramClient } from './telegramClient.js';
import { Video } from '../../models/Video.js';
import { User } from '../../models/User.js';
import { logger } from '../../utils/logger.js';

const CACHE_DIR = path.join(process.cwd(), 'media_cache');
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// In-flight download deduplication map so multiple browser range probes share the exact same download
const activeDownloads = new Map();

export function getVideoDownloadStatus(videoId) {
  const cacheFilePath = path.join(CACHE_DIR, `${videoId}.mp4`);
  if (fs.existsSync(cacheFilePath) && fs.statSync(cacheFilePath).size > 0) {
    return { cached: true, downloading: false, progress: 100 };
  }
  return { cached: false, downloading: activeDownloads.has(String(videoId)), progress: 0 };
}

function serveLocalFile(req, res, filePath, mimeType) {
  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', mimeType || 'video/mp4');

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (start >= fileSize || end >= fileSize) {
      res.status(416).setHeader('Content-Range', `bytes */${fileSize}`);
      return res.end();
    }

    const chunksize = end - start + 1;
    const file = fs.createReadStream(filePath, { start, end });

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Content-Length': chunksize,
      'Content-Type': mimeType || 'video/mp4'
    });

    file.pipe(res);
    file.on('error', () => {
      if (!res.headersSent) res.sendStatus(500);
    });
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': mimeType || 'video/mp4'
    });
    fs.createReadStream(filePath).pipe(res);
  }
}

export async function streamVideoFromTelegram(req, res, user) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Accept-Ranges', 'bytes');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  try {
    const { id } = req.params;
    const video = await Video.findById(id);

    if (!video || !video.telegramChatId || !video.telegramMessageId) {
      return res.status(404).json({ error: 'Video source not located in database' });
    }

    const cacheFilePath = path.join(CACHE_DIR, `${video._id}.mp4`);

    // 1. FAST PATH: Already cached on disk -> stream instantly with full range seeking
    if (fs.existsSync(cacheFilePath) && fs.statSync(cacheFilePath).size > 0) {
      return serveLocalFile(req, res, cacheFilePath, video.mimeType);
    }

    // 2. Resolve active Telegram session
    let activeUser = user;
    if (!activeUser || !activeUser.encryptedTelegramSession) {
      activeUser = await User.findOne({ encryptedTelegramSession: { $ne: null } });
    }

    if (!activeUser || !activeUser.encryptedTelegramSession) {
      return res.status(401).json({
        error: 'No active Telegram session found. Re-authenticate in Telegram Import.'
      });
    }

    const client = await getTelegramClient(activeUser);
    if (!client || !client.connected) {
      return res.status(503).json({ error: 'Telegram MTProto client is not connected' });
    }

    // 3. Resolve channel entity
    let entity;
    const chatId = video.telegramChatId;
    const numId = chatId.startsWith('-100')
      ? BigInt(chatId)
      : chatId.match(/^-?\d+$/)
        ? BigInt(chatId)
        : chatId;

    try {
      entity = await client.getEntity(numId);
    } catch {
      try {
        await client.getDialogs({ limit: 100 });
        entity = await client.getEntity(numId);
      } catch {
        entity = chatId;
      }
    }

    const [message] = await client.getMessages(entity, {
      ids: [parseInt(video.telegramMessageId, 10)]
    });

    if (!message || !message.media) {
      return res.status(404).json({ error: 'Media message not found or revoked on Telegram' });
    }

    // 4. Maximum-Speed Parallel Download (16 Workers) with Single-Task Deduplication
    const videoKey = String(video._id);
    if (!activeDownloads.has(videoKey)) {
      const tempPath = `${cacheFilePath}.part`;

      if (fs.existsSync(tempPath)) {
        try { fs.unlinkSync(tempPath); } catch {}
      }

      logger.info(`Starting high-speed 16-worker download for video ${videoKey}...`);

      const downloadPromise = client
        .downloadMedia(message, {
          outputFile: tempPath,
          workers: 16 // Maximum parallel MTProto throughput
        })
        .then(() => {
          if (fs.existsSync(tempPath) && fs.statSync(tempPath).size > 0) {
            fs.renameSync(tempPath, cacheFilePath);
            logger.info(`✓ Video ${videoKey} cached successfully on disk.`);
          }
        })
        .catch((err) => {
          logger.error({ err }, `Error downloading video ${videoKey}`);
          if (fs.existsSync(tempPath)) {
            try { fs.unlinkSync(tempPath); } catch {}
          }
          throw err;
        })
        .finally(() => {
          activeDownloads.delete(videoKey);
        });

      activeDownloads.set(videoKey, downloadPromise);
    }

    // Wait for the parallel download to complete (takes only 2-4 seconds)
    await activeDownloads.get(videoKey);

    // 5. Serve the clean, uncorrupted cached video file
    if (fs.existsSync(cacheFilePath) && fs.statSync(cacheFilePath).size > 0) {
      return serveLocalFile(req, res, cacheFilePath, video.mimeType);
    } else {
      throw new Error('Failed caching media file from Telegram');
    }
  } catch (error) {
    logger.error({ error }, 'Error during media stream handling');
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || 'Media streaming failed' });
    } else {
      res.end();
    }
  }
}