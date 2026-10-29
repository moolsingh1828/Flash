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

    // 1. FAST PATH: If file was already cached previously, serve from disk instantly!
    const cacheFilePath = path.join(CACHE_DIR, `${video._id}.mp4`);
    if (fs.existsSync(cacheFilePath)) {
      const stat = fs.statSync(cacheFilePath);
      if (stat.size > 0) {
        return serveLocalFile(req, res, cacheFilePath, video.mimeType);
      }
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
    const targetMedia = doc || vid || message.media;

    let fileSize = video.fileSize || 0;
    if (doc?.size) fileSize = Number(doc.size);
    else if (vid?.size) fileSize = Number(vid.size);

    const mimeType = video.mimeType || doc?.mimeType || 'video/mp4';

    // 4. ON-DEMAND LIVE STREAMING (NO WAITING FOR FULL DOWNLOAD)
    const range = req.headers.range;
    let start = 0;
    let end = fileSize > 0 ? fileSize - 1 : 0;

    // Stream in continuous 2MB slices for instantaneous startup and smooth playback
    const maxChunkSize = 2 * 1024 * 1024; // 2MB

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      start = parseInt(parts[0], 10);
      if (parts[1]) {
        end = parseInt(parts[1], 10);
      } else {
        end = Math.min(start + maxChunkSize - 1, fileSize > 0 ? fileSize - 1 : start + maxChunkSize - 1);
      }
    } else {
      end = Math.min(maxChunkSize - 1, fileSize > 0 ? fileSize - 1 : maxChunkSize - 1);
    }

    if (fileSize > 0 && (start >= fileSize || end >= fileSize)) {
      res.status(416).setHeader('Content-Range', `bytes */${fileSize}`);
      return res.end();
    }

    const contentLength = end - start + 1;

    // Telegram MTProto strictly requires offset to be divisible by 4096 bytes
    const telegramOffset = Math.floor(start / 4096) * 4096;
    const skipBytes = start - telegramOffset;
    const fetchLimit = contentLength + skipBytes;

    res.writeHead(range ? 206 : 200, {
      'Content-Range': `bytes ${start}-${end}/${fileSize > 0 ? fileSize : '*'}`,
      'Content-Length': contentLength,
      'Content-Type': mimeType,
      'Accept-Ranges': 'bytes',
      'Access-Control-Allow-Origin': '*',
      'Cross-Origin-Resource-Policy': 'cross-origin'
    });

    // Stream directly from Telegram MTProto on the fly
    const stream = client.iterDownload({
      file: targetMedia,
      offset: BigInt(telegramOffset),
      limit: fetchLimit,
      requestSize: 128 * 1024
    });

    let bytesSent = 0;
    let skipped = 0;

    for await (const rawChunk of stream) {
      if (res.writableEnded || res.closed) break;

      let chunk = rawChunk;

      // Skip alignment bytes if offset was aligned to 4096
      if (skipped < skipBytes) {
        const toSkip = Math.min(skipBytes - skipped, chunk.length);
        chunk = chunk.subarray(toSkip);
        skipped += toSkip;
      }

      if (chunk.length === 0) continue;

      // Slice to exact requested contentLength
      const remaining = contentLength - bytesSent;
      if (chunk.length > remaining) {
        chunk = chunk.subarray(0, remaining);
      }

      bytesSent += chunk.length;
      const canContinue = res.write(chunk);
      if (!canContinue && !res.closed) {
        await new Promise((resolve) => res.once('drain', resolve));
      }

      if (bytesSent >= contentLength) {
        break;
      }
    }

    if (!res.writableEnded) {
      res.end();
    }
  } catch (error) {
    logger.error({ error }, 'Error during on-demand streaming from Telegram');
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || 'Media streaming failed' });
    } else {
      res.end();
    }
  }
}