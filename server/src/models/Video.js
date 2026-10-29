import mongoose from 'mongoose';

const videoSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, index: true },
  originalCaption: { type: String, default: '' },
  originalFilename: { type: String, default: '' },
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', default: null, index: true },
  folderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null, index: true },
  source: { type: String, enum: ['telegram', 'manual'], default: 'telegram' },
  telegramChatId: { type: String, default: null },
  telegramMessageId: { type: String, default: null },
  mediaType: { type: String, default: 'video' },
  mimeType: { type: String, default: 'video/mp4' },
  fileSize: { type: Number, default: 0 },
  duration: { type: Number, default: 0 },
  order: { type: Number, default: 0 },
  importStatus: { type: String, enum: ['completed', 'failed', 'pending'], default: 'completed' },
  subtitles: { type: String, default: null }, // Stores generated or uploaded WebVTT text
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

videoSchema.index({ source: 1, telegramChatId: 1, telegramMessageId: 1 }, { unique: true, sparse: true });
videoSchema.index({ title: 'text', originalCaption: 'text', originalFilename: 'text' });

videoSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export const Video = mongoose.model('Video', videoSchema);