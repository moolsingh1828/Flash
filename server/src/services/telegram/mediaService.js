import fs from 'fs';
import path from 'path';
import { Writable } from 'stream';
import { getTelegramClient } from './telegramClient.js';
import { Video } from '../../models/Video.js';
import { User } from '../../models/User.js';
import { logger } from '../../utils/logger.js';

const CACHE_DIR = path.join(process.cwd(), 'media_cache');
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// Track active background downloads to prevent duplicate streams
const activeDownloads = new Map();

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

    // 1. FAST PATH: Already cached on disk -> stream instantly
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

    const doc = message.media.document;
    const vid = message.media.video;
    let fileSize = video.fileSize || 0;
    if (doc?.size) fileSize = Number(doc.size);
    else if (vid?.size) fileSize = Number(vid.size);

    const mimeType = video.mimeType || doc?.mimeType || 'video/mp4';

    // 4. Send headers so browser decodes metadata
    const range = req.headers.range;
    if (range) {
      res.writeHead(206, {
        'Content-Range': `bytes 0-${fileSize - 1}/${fileSize}`,
        'Content-Length': fileSize,
        'Content-Type': mimeType,
        'Accept-Ranges': 'bytes'
      });
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': mimeType,
        'Accept-Ranges': 'bytes'
      });
    }

    // 5. Dual Stream Writer with resilient close/drain handling
    const tempPath = `${cacheFilePath}.part`;
    const fileWriteStream = fs.createWriteStream(tempPath, { flags: 'a' });

    const dualWriter = new Writable({
      write(chunk, encoding, callback) {
        fileWriteStream.write(chunk);

        if (!res.writableEnded && !res.closed) {
          const canContinue = res.write(chunk);
          if (!canContinue) {
            let handled = false;
            const cleanup = () => {
              if (handled) return;
              handled = true;
              res.removeListener('drain', onDrain);
              res.removeListener('close', onClose);
              callback();
            };
            const onDrain = () => cleanup();
            const onClose = () => cleanup();

            res.once('drain', onDrain);
            res.once('close', onClose);
            return;
          }
        }
        callback();
      },
      final(callback) {
        fileWriteStream.end();
        if (fs.existsSync(tempPath)) {
          fs.renameSync(tempPath, cacheFilePath);
          logger.info(`✓ Video ${video._id} successfully cached on disk.`);
        }
        if (!res.writableEnded) {
          res.end();
        }
        callback();
      }
    });

    // Start streaming directly to dualWriter
    await client.downloadMedia(message, {
      outputFile: dualWriter,
      workers: 1
    });
  } catch (error) {
    logger.error({ error }, 'Error during media stream piping');
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || 'Media streaming failed' });
    } else {
      res.end();
    }
  }
}