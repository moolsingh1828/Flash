import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { Course } from '../src/models/Course.js';
import { Folder } from '../src/models/Folder.js';
import { Video } from '../src/models/Video.js';

describe('Catalog and Hierarchy Integrity Suite', () => {
  beforeAll(async () => {
    await mongoose.connect('mongodb://127.0.0.1:27017/telegram_test_db');
    await Course.deleteMany({});
    await Folder.deleteMany({});
    await Video.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  });

  it('creates course and assigns folders with prevent-duplicate unique index on videos', async () => {
    const course = await Course.create({
      title: 'Advanced React Architecture',
      description: 'Comprehensive design pattern course'
    });

    const folder = await Folder.create({
      name: 'Module 01 - Foundations',
      courseId: course._id,
      order: 1
    });

    const video = await Video.create({
      title: '01 - Introduction',
      courseId: course._id,
      folderId: folder._id,
      source: 'telegram',
      telegramChatId: '-100123456789',
      telegramMessageId: '101',
      mimeType: 'video/mp4',
      fileSize: 10485760
    });

    expect(video._id).toBeDefined();
    expect(video.courseId.toString()).toBe(course._id.toString());

    let duplicateError = null;
    try {
      await Video.create({
        title: 'Duplicate Message Record',
        courseId: course._id,
        folderId: folder._id,
        source: 'telegram',
        telegramChatId: '-100123456789',
        telegramMessageId: '101'
      });
    } catch (err) {
      duplicateError = err;
    }

    expect(duplicateError).not.toBeNull();
    expect(duplicateError.code).toBe(11000);
  });
});
