import { getTelegramClient } from './telegramClient.js';
import { Video } from '../../models/Video.js';
import { logger } from '../../utils/logger.js';

export async function streamVideoFromTelegram(req, res, user) {
  // Set headers immediately to satisfy any browser checks
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

    const client = await getTelegramClient(user);
    if (!client || !client.connected) {
      return res.status(503).json({ error: 'Telegram MTProto client is not connected' });
    }

    // Resolve channel entity with automatic cache warming if server just started
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
      // Entity not found in memory cache on cold start -> warm up cache with dialogs
      try {
        await client.getDialogs({ limit: 100 });
        entity = await client.getEntity(numId);
      } catch (err2) {
        logger.error({ err2 }, 'Failed resolving channel entity after cache warming');
        try {
          entity = await client.getInputEntity(chatId);
        } catch {
          entity = chatId;
        }
      }
    }

    const [message] = await client.getMessages(entity, {
      ids: [parseInt(video.telegramMessageId, 10)]
    });

    if (!message || !message.media) {
      return res.status(404).json({ error: 'Message media unavailable or revoked on Telegram' });
    }

    const doc = message.media.document;
    const vid = message.media.video;
    const targetMedia = doc || vid || message.media;

    let fileSize = video.fileSize || 0;
    if (doc?.size) fileSize = Number(doc.size);
    else if (vid?.size) fileSize = Number(vid.size);

    const mimeType = video.mimeType || doc?.mimeType || 'video/mp4';
    res.setHeader('Content-Type', mimeType);

    const range = req.headers.range;

    // Direct streaming without Range header
    if (!range) {
      if (fileSize > 0) {
        res.setHeader('Content-Length', fileSize);
      }
      res.status(200);

      const stream = client.iterDownload({
        file: targetMedia,
        requestSize: 256 * 1024
      });

      for await (const chunk of stream) {
        if (res.writableEnded || res.closed) break;
        res.write(chunk);
      }
      return res.end();
    }

    // HTTP 206 Partial Content range requests
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const chunkSize = 1024 * 1024 * 2; // 2MB chunk window
    const end = parts[1]
      ? parseInt(parts[1], 10)
      : Math.min(start + chunkSize - 1, fileSize > 0 ? fileSize - 1 : start + chunkSize - 1);

    if (fileSize > 0 && (start >= fileSize || end >= fileSize)) {
      res.status(416).setHeader('Content-Range', `bytes */${fileSize}`);
      return res.end();
    }

    const contentLength = end - start + 1;

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize > 0 ? fileSize : '*'}`,
      'Content-Length': contentLength,
      'Content-Type': mimeType,
      'Accept-Ranges': 'bytes',
      'Access-Control-Allow-Origin': '*',
      'Cross-Origin-Resource-Policy': 'cross-origin'
    });

    const stream = client.iterDownload({
      file: targetMedia,
      offset: BigInt(start),
      limit: contentLength,
      requestSize: 128 * 1024
    });

    for await (const chunk of stream) {
      if (res.writableEnded || res.closed) break;
      res.write(chunk);
    }
    res.end();
  } catch (error) {
    logger.error({ error }, 'Error during media stream piping');
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || 'Failed streaming media content' });
    } else {
      res.end();
    }
  }
}