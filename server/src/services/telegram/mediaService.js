import fs from 'fs';
import path from 'path';
import { getTelegramClient } from './telegramClient.js';
import { Video } from '../../models/Video.js';
import { User } from '../../models/User.js';
import { logger } from '../../utils/logger.js';

// Cache directory outside the public root
const CACHE_DIR = path.join(process.cwd(), 'media_cache');
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// Track active background downloads to prevent duplicate downloads from Telegram
const activeDownloads = new Map();

/**
 * Serves fully cached files from disk with full HTTP 206 Range seeking
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

    // 1. FAST PATH: If file is already fully cached, serve it from disk instantly!
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

    // 3. Resolve channel entity (warm entity cache if server recently started)
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
    const targetMedia = doc || vid || message.media;

    let fileSize = video.fileSize || 0;
    if (doc?.size) fileSize = Number(doc.size);
    else if (vid?.size) fileSize = Number(vid.size);

    const mimeType = video.mimeType || doc?.mimeType || 'video/mp4';

    // 4. PROGRESSIVE STREAMING: Stream directly to browser while saving to disk
    const tempPath = `${cacheFilePath}.part`;
    const fileWriteStream = fs.createWriteStream(tempPath, { flags: 'w' });

    // Send HTTP 206 headers immediately so the browser initializes the video element
    res.writeHead(206, {
      'Content-Range': `bytes 0-${fileSize - 1}/${fileSize}`,
      'Content-Length': fileSize,
      'Content-Type': mimeType,
      'Accept-Ranges': 'bytes',
      'Access-Control-Allow-Origin': '*',
      'Cross-Origin-Resource-Policy': 'cross-origin'
    });

    logger.info(`Starting progressive stream & cache for video ${video._id} (${fileSize} bytes)...`);

    // Download in 256 KB slices from Telegram MTProto
    const stream = client.iterDownload({
      file: targetMedia,
      requestSize: 256 * 1024
    });

    try {
      for await (const chunk of stream) {
        // A. Write to local cache on disk
        fileWriteStream.write(chunk);

        // B. Stream chunk directly to the browser in real-time
        if (!res.writableEnded && !res.closed) {
          const canContinue = res.write(chunk);
          // Handle backpressure if browser network is slower than Telegram download
          if (!canContinue) {
            await new Promise((resolve) => res.once('drain', resolve));
          }
        }
      }

      fileWriteStream.end();

      // Rename .part to .mp4 once 100% complete
      if (fs.existsSync(tempPath)) {
        fs.renameSync(tempPath, cacheFilePath);
        logger.info(`✓ Video ${video._id} fully cached on disk.`);
      }

      if (!res.writableEnded) {
        res.end();
      }
    } catch (downloadError) {
      fileWriteStream.end();
      if (fs.existsSync(tempPath)) {
        try { fs.unlinkSync(tempPath); } catch {}
      }
      throw downloadError;
    }
  } catch (error) {
    logger.error({ error }, 'Error during progressive media streaming');
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || 'Media streaming failed' });
    } else {
      res.end();
    }
  }
}