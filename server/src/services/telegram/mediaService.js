import fs from 'fs';
import path from 'path';
import { getTelegramClient } from './telegramClient.js';
import { Video } from '../../models/Video.js';
import { User } from '../../models/User.js';
import { logger } from '../../utils/logger.js';

// Ensure media_cache directory exists outside public directory
const CACHE_DIR = path.join(process.cwd(), 'media_cache');
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// In-memory download locks to prevent concurrent duplicate downloads of the same video
const activeDownloads = new Map();

/**
 * Streams a local cached file with full RFC 7233 HTTP Range support
 */
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
    file.on('error', (err) => {
      logger.error({ err }, 'Error piping file stream chunk');
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

    // 1. FAST PATH: If file is already cached on disk, stream it immediately!
    if (fs.existsSync(cacheFilePath)) {
      const stat = fs.statSync(cacheFilePath);
      if (stat.size > 0) {
        return serveLocalFile(req, res, cacheFilePath, video.mimeType);
      }
    }

    // 2. Resolve authenticated user session
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

    const isAuth = await client.checkAuthorization();
    if (!isAuth) {
      return res.status(401).json({
        error: 'Telegram session expired. Please re-authenticate via Telegram Import.'
      });
    }

    // 3. Resolve channel peer and warm cache if needed
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

    // 4. Download on-demand with concurrency deduplication
    if (!activeDownloads.has(String(video._id))) {
      logger.info(`Starting Telegram download to cache for video ${video._id}...`);
      const tempPath = `${cacheFilePath}.tmp`;

      const downloadPromise = client
        .downloadMedia(message, {
          outputFile: tempPath,
          progressCallback: (downloaded, total) => {
            if (total) {
              const pct = Math.round((Number(downloaded) / Number(total)) * 100);
              logger.info(`Caching video ${video._id}: ${pct}%`);
            }
          }
        })
        .then(() => {
          if (fs.existsSync(tempPath)) {
            fs.renameSync(tempPath, cacheFilePath);
            logger.info(`✓ Successfully cached video ${video._id}`);
          }
        })
        .catch((err) => {
          logger.error({ err }, `Error downloading video ${video._id} from Telegram`);
          if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
          throw err;
        })
        .finally(() => {
          activeDownloads.delete(String(video._id));
        });

      activeDownloads.set(String(video._id), downloadPromise);
    }

    // Wait for the download to finish
    await activeDownloads.get(String(video._id));

    // 5. Stream the cached file to the client with full Range seeking support
    if (fs.existsSync(cacheFilePath)) {
      return serveLocalFile(req, res, cacheFilePath, video.mimeType);
    } else {
      throw new Error('Failed to cache video file from Telegram');
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