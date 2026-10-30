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

const activeDownloads = new Map();

export function getVideoDownloadStatus(videoId) {
  const cacheFilePath = path.join(CACHE_DIR, `${videoId}.mp4`);
  if (fs.existsSync(cacheFilePath) && fs.statSync(cacheFilePath).size > 0) {
    return { cached: true, downloading: false, progress: 100 };
  }
  return { cached: false, downloading: activeDownloads.has(String(videoId)), progress: 0 };
}

async function waitForBytes(filePath, targetBytes, maxWaitMs = 20000) {
  const startTime = Date.now();
  while (Date.now() - startTime < maxWaitMs) {
    if (fs.existsSync(filePath)) {
      const size = fs.statSync(filePath).size;
      if (size >= targetBytes) return size;
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  return fs.existsSync(filePath) ? fs.statSync(filePath).size : 0;
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

    if (fs.existsSync(cacheFilePath) && fs.statSync(cacheFilePath).size > 0) {
      return serveLocalFile(req, res, cacheFilePath, video.mimeType);
    }

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

    const doc = message.media.document;
    const vid = message.media.video;
    let fileSize = video.fileSize || 0;
    if (doc?.size) fileSize = Number(doc.size);
    else if (vid?.size) fileSize = Number(vid.size);

    const mimeType = video.mimeType || doc?.mimeType || 'video/mp4';

    const videoKey = String(video._id);
    const tempPath = `${cacheFilePath}.part`;

    if (!activeDownloads.has(videoKey)) {
      logger.info(`Starting background download for video ${videoKey}...`);
      const downloadPromise = client
        .downloadMedia(message, {
          outputFile: tempPath,
          workers: 8
        })
        .then(() => {
          if (fs.existsSync(tempPath) && fs.statSync(tempPath).size > 0) {
            fs.renameSync(tempPath, cacheFilePath);
            logger.info(`✓ Video ${videoKey} 100% cached on disk.`);
          }
        })
        .catch((err) => {
          logger.error({ err }, `Error downloading video ${videoKey}`);
          if (fs.existsSync(tempPath)) {
            try {
              fs.unlinkSync(tempPath);
            } catch {}
          }
        })
        .finally(() => {
          activeDownloads.delete(videoKey);
        });

      activeDownloads.set(videoKey, downloadPromise);
    }

    const range = req.headers.range;
    let start = 0;
    let end = fileSize > 0 ? fileSize - 1 : 0;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      start = parseInt(parts[0], 10);
      if (parts[1]) end = parseInt(parts[1], 10);
    }

    const initialBufferTarget = start === 0 ? Math.min(1.5 * 1024 * 1024, fileSize) : start + 64 * 1024;
    await waitForBytes(tempPath, initialBufferTarget, 15000);

    const currentBuffered = fs.existsSync(tempPath) ? fs.statSync(tempPath).size : 0;

    if (currentBuffered <= start && !fs.existsSync(cacheFilePath)) {
      await waitForBytes(tempPath, start + 512 * 1024, 20000);
    }

    const streamTarget = fs.existsSync(cacheFilePath) ? cacheFilePath : tempPath;
    const availableSize = fs.existsSync(streamTarget) ? fs.statSync(streamTarget).size : 0;

    if (availableSize <= start) {
      res.status(503).json({ error: 'Buffering stream from Telegram, please retry in a moment' });
      return;
    }

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Accept-Ranges', 'bytes');

    if (range) {
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${fileSize - 1}/${fileSize}`,
        'Content-Length': fileSize - start
      });
      fs.createReadStream(streamTarget, { start }).pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize
      });
      fs.createReadStream(streamTarget, { start: 0 }).pipe(res);
    }
  } catch (error) {
    logger.error({ error }, 'Error during media stream piping');
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || 'Media streaming failed' });
    } else {
      res.end();
    }
  }
}