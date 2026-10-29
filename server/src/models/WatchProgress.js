import mongoose from 'mongoose';

const watchProgressSchema = new mongoose.Schema({
  videoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Video', required: true, unique: true },
  positionSeconds: { type: Number, default: 0, min: 0 },
  completed: { type: Boolean, default: false },
  lastWatchedAt: { type: Date, default: Date.now }
});

export const WatchProgress = mongoose.model('WatchProgress', watchProgressSchema);
