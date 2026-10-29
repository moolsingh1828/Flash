import mongoose from 'mongoose';

const folderSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
  parentFolderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null, index: true },
  order: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

folderSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export const Folder = mongoose.model('Folder', folderSchema);
