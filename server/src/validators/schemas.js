import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

export const courseCreateSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  coverImage: z.string().url().optional().or(z.literal(''))
});

export const folderCreateSchema = z.object({
  name: z.string().min(1).max(100),
  courseId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid Course ID'),
  parentFolderId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid Parent Folder ID').nullable().optional(),
  order: z.number().optional()
});

export const videoUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  courseId: z.string().regex(/^[0-9a-fA-F]{24}$/).nullable().optional(),
  folderId: z.string().regex(/^[0-9a-fA-F]{24}$/).nullable().optional(),
  order: z.number().optional()
});

export const progressUpdateSchema = z.object({
  positionSeconds: z.number().min(0),
  completed: z.boolean().optional()
});
