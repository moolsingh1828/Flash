import mongoose from 'mongoose';

const importJobSchema = new mongoose.Schema({
  sourceChannelId: { type: String, required: true },
  status: { type: String, enum: ['running', 'completed', 'failed', 'cancelled'], default: 'running' },
  messagesScanned: { type: Number, default: 0 },
  videosDiscovered: { type: Number, default: 0 },
  videosImported: { type: Number, default: 0 },
  itemsSkipped: { type: Number, default: 0 },
  errorCount: { type: Number, default: 0 },
  lastProcessedMessageId: { type: String, default: null },
  errorMessage: { type: String, default: null },
  startedAt: { type: Date, default: Date.now },
  completedAt: { type: Date, default: null }
});

export const ImportJob = mongoose.model('ImportJob', importJobSchema);
