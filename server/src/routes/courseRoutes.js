import { Router } from 'express';
import { createCourse, deleteCourse, getCourseDetails, getCourses, updateCourse } from '../controllers/courseController.js';
import { requireAuth } from '../middleware/auth.js';

export const courseRouter = Router();
courseRouter.use(requireAuth);
courseRouter.get('/', getCourses);
courseRouter.post('/', createCourse);
courseRouter.get('/:id', getCourseDetails);
courseRouter.patch('/:id', updateCourse);
courseRouter.delete('/:id', deleteCourse);
