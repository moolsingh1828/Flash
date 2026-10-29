import { Folder } from '../models/Folder.js';
import { Video } from '../models/Video.js';
import { folderCreateSchema } from '../validators/schemas.js';

export async function createFolder(req, res, next) {
  try {
    const data = folderCreateSchema.parse(req.body);
    const folder = await Folder.create(data);
    res.status(201).json(folder);
  } catch (err) {
    next(err);
  }
}

export async function updateFolder(req, res, next) {
  try {
    const folder = await Folder.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!folder) return res.status(404).json({ error: 'Folder not found' });
    res.json(folder);
  } catch (err) {
    next(err);
  }
}

export async function deleteFolder(req, res, next) {
  try {
    const folder = await Folder.findById(req.params.id);
    if (!folder) return res.status(404).json({ error: 'Folder not found' });
    await Video.updateMany({ folderId: folder._id }, { $set: { folderId: null } });
    await Folder.findByIdAndDelete(folder._id);
    res.json({ message: 'Folder deleted successfully' });
  } catch (err) {
    next(err);
  }
}
