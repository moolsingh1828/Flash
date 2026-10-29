import { getTelegramClient } from './telegramClient.js';
import { Video } from '../../models/Video.js';
import { logger } from '../../utils/logger.js';

export async function streamVideoFromTelegram(req, res, user) {
  const { id } = req.params;
  const video = await Video.findById(id);

  if (!video || !video.telegramChatId || !video.telegramMessageId) {
    return res.status(404).json({ error: 'Video source not located' });
  }

  const client = await getTelegramClient(user);
  let entity;
  try {
    entity = await client.getInputEntity(video.telegramChatId);
  } catch (err) {
    entity = video.telegramChatId;
  }

  const [message] = await client.getMessages(entity, {
    ids: [parseInt(video.telegramMessageId, 10)]
  });

  if (!message || !message.media) {
    return res.status(404).json({ error: 'Message media unavailable or revoked on Telegram' });
  }

  const media = message.media.document || message.media.video;
  const fileSize = Number(media.size);
  const range = req.headers.range;

if (!range) {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': video.mimeType || 'video/mp4',
      'Accept-Ranges': 'bytes',
      'Access-Control-Allow-Origin': '*',
      'Cross-Origin-Resource-Policy': 'cross-origin'
    });
    return res.end();
  }

  const parts = range.replace(/bytes=/, '').split('-');
  const start = parseInt(parts[0], 10);
  const chunkSize = 1024 * 1024 * 2; // 2MB stream slices
  const end = parts[1] ? parseInt(parts[1], 10) : Math.min(start + chunkSize - 1, fileSize - 1);

  if (start >= fileSize || end >= fileSize) {
    res.status(416).setHeader('Content-Range', `bytes */${fileSize}`);
    return res.end();
  }

  const contentLength = end - start + 1;
res.writeHead(206, {
    'Content-Range': `bytes ${start}-${end}/${fileSize}`,
    'Accept-Ranges': 'bytes',
    'Content-Length': contentLength,
    'Content-Type': video.mimeType || 'video/mp4',
    'Access-Control-Allow-Origin': '*',
    'Cross-Origin-Resource-Policy': 'cross-origin'
  });

  try {
    const stream = client.iterDownload({
      file: message.media,
      offset: BigInt(start),
      limit: contentLength,
      requestSize: 128 * 1024
    });

    for await (const chunk of stream) {
      if (res.writableEnded) break;
      res.write(chunk);
    }
    res.end();
  } catch (error) {
    if (!res.headersSent) res.status(500).json({ error: 'Failed streaming media content' });
    else res.end();
  }
}
