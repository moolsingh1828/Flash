import { Video } from '../../models/Video.js';
import { Course } from '../../models/Course.js';
import { Folder } from '../../models/Folder.js';
import { ImportJob } from '../../models/ImportJob.js';
import { logger } from '../../utils/logger.js';

function parseCaptionOrFilename(text, filename = '') {
  const combined = `${text}\n${filename}`.trim();
  const moduleMatch = combined.match(/(?:module|section|chapter)\s*([0-9]+)[\s:-]+([^\n\r]+)/i);
  const lessonMatch = combined.match(/(?:lesson|lecture|part|\b)\s*([0-9]{1,3})[\s._-]+([^\n\r.]+)/i);

  let detectedModule = null;
  let detectedLesson = text.split('\n')[0].slice(0, 100) || filename || 'Untitled Video';
  let orderNumber = 0;

  if (moduleMatch) detectedModule = `Module ${moduleMatch[1]} - ${moduleMatch[2].trim()}`;
  if (lessonMatch) {
    orderNumber = parseInt(lessonMatch[1], 10);
    detectedLesson = `${String(orderNumber).padStart(2, '0')} - ${lessonMatch[2].trim()}`;
  }

  return { detectedModule, detectedLesson, orderNumber };
}

export async function runChannelImport(client, channelId, importJobId) {
  const job = await ImportJob.findById(importJobId);
  if (!job) return;

  try {
    let peer;
    try { peer = await client.getInputEntity(channelId); } catch (err) { peer = channelId; }
    const entity = await client.getEntity(peer);
    const courseTitle = entity.title || `Imported Channel (${channelId})`;

    let course = await Course.findOne({ sourceChannelId: String(channelId) });
    if (!course) {
      course = await Course.create({
        title: courseTitle,
        description: `Imported from Telegram channel: ${courseTitle}`,
        source: 'telegram',
        sourceChannelId: String(channelId)
      });
    }

    let unorganizedFolder = await Folder.findOne({ name: 'Unorganized', courseId: course._id });
    if (!unorganizedFolder) {
      unorganizedFolder = await Folder.create({ name: 'Unorganized', courseId: course._id, order: 999 });
    }

    const folderCache = new Map();
    folderCache.set('unorganized', unorganizedFolder._id);

    let offsetId = 0;
    const batchLimit = 50;
    let hasMore = true;

    while (hasMore) {
      const checkStatus = await ImportJob.findById(importJobId);
      if (checkStatus.status === 'cancelled') return;

      const messages = await client.getMessages(peer, { limit: batchLimit, offsetId });
      if (!messages || messages.length === 0) break;

      for (const msg of messages) {
        job.messagesScanned += 1;
        offsetId = msg.id;

        const isVideo = msg.media && (msg.media.video || (msg.media.document && msg.media.document.mimeType?.startsWith('video/')));
        if (!isVideo) {
          job.itemsSkipped += 1;
          continue;
        }

        job.videosDiscovered += 1;
        let filename = '', mimeType = 'video/mp4', duration = 0, fileSize = 0;

        if (msg.media.document) {
          mimeType = msg.media.document.mimeType || 'video/mp4';
          fileSize = Number(msg.media.document.size || 0);
          const nameAttr = msg.media.document.attributes?.find(attr => attr.fileName);
          if (nameAttr) filename = nameAttr.fileName;
          const videoAttr = msg.media.document.attributes?.find(attr => attr.duration !== undefined);
          if (videoAttr) duration = videoAttr.duration;
        } else if (msg.media.video) {
          duration = msg.media.video.duration || 0;
          fileSize = Number(msg.media.video.size || 0);
        }

        const rawCaption = msg.message || '';
        const { detectedModule, detectedLesson, orderNumber } = parseCaptionOrFilename(rawCaption, filename);

        let targetFolderId = unorganizedFolder._id;
        if (detectedModule) {
          if (!folderCache.has(detectedModule)) {
            let modFolder = await Folder.findOne({ name: detectedModule, courseId: course._id });
            if (!modFolder) {
              modFolder = await Folder.create({ name: detectedModule, courseId: course._id, order: folderCache.size });
            }
            folderCache.set(detectedModule, modFolder._id);
          }
          targetFolderId = folderCache.get(detectedModule);
        }

        try {
          await Video.findOneAndUpdate(
            { source: 'telegram', telegramChatId: String(channelId), telegramMessageId: String(msg.id) },
            {
              title: detectedLesson,
              originalCaption: rawCaption,
              originalFilename: filename,
              courseId: course._id,
              folderId: targetFolderId,
              source: 'telegram',
              telegramChatId: String(channelId),
              telegramMessageId: String(msg.id),
              mimeType,
              fileSize,
              duration,
              order: orderNumber,
              importStatus: 'completed'
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
          );
          job.videosImported += 1;
        } catch (err) {
          job.errorCount += 1;
        }
        job.lastProcessedMessageId = String(msg.id);
      }
      await job.save();
      await new Promise(r => setTimeout(r, 600));
    }

    job.status = 'completed';
    job.completedAt = new Date();
    await job.save();
  } catch (error) {
    job.status = 'failed';
    job.errorMessage = error.message;
    job.completedAt = new Date();
    await job.save();
  }
}
