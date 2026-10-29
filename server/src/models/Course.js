import mongoose from 'mongoose';

const courseSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, index: true },
  description: { type: String, default: '' },
  coverImage: { type: String, default: '' },
  source: { type: String, default: 'manual' },
  sourceChannelId: { type: String, default: null, index: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

courseSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export const Course = mongoose.model('Course', courseSchema);
