import fs from 'fs';
import path from 'path';
import { Course } from '../models/Course.js';
import { Folder } from '../models/Folder.js';
import { Video } from '../models/Video.js';
import { courseCreateSchema } from '../validators/schemas.js';

const CACHE_DIR = path.join(process.cwd(), 'media_cache');

export async function getCourses(req, res, next) {
  try {
    const courses = await Course.find().sort({ updatedAt: -1 });
    res.json(courses);
  } catch (err) {
    next(err);
  }
}

export async function createCourse(req, res, next) {
  try {
    const data = courseCreateSchema.parse(req.body);
    const course = await Course.create(data);
    res.status(201).json(course);
  } catch (err) {
    next(err);
  }
}

export async function getCourseDetails(req, res, next) {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ error: 'Course not found' });
    const folders = await Folder.find({ courseId: course._id }).sort({ order: 1 });
    const videos = await Video.find({ courseId: course._id }).sort({ order: 1 });
    res.json({ course, folders, videos });
  } catch (err) {
    next(err);
  }
}

export async function updateCourse(req, res, next) {
  try {
    const { title, description, coverImage } = req.body;
    const course = await Course.findByIdAndUpdate(
      req.params.id,
      { $set: { title, description, coverImage, updatedAt: new Date() } },
      { new: true }
    );
    if (!course) return res.status(404).json({ error: 'Course not found' });
    res.json(course);
  } catch (err) {
    next(err);
  }
}

export async function deleteCourse(req, res, next) {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ error: 'Course not found' });

    // Find all videos associated with this course to clean up cached files
    const videos = await Video.find({ courseId: course._id });
    for (const v of videos) {
      const cachedFile = path.join(CACHE_DIR, `${v._id}.mp4`);
      if (fs.existsSync(cachedFile)) {
        try { fs.unlinkSync(cachedFile); } catch {}
      }
    }

    // Delete folders & videos associated with this course
    await Folder.deleteMany({ courseId: course._id });
    await Video.deleteMany({ courseId: course._id });
    await Course.findByIdAndDelete(course._id);

    res.json({ message: 'Course and all associated lessons removed successfully.' });
  } catch (err) {
    next(err);
  }
}