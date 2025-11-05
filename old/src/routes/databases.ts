import { Router } from 'express';
import multer from 'multer';
import { body, param } from 'express-validator';
import { validateRequest } from '../middleware/validateRequest';
import * as databaseController from '../controllers/databaseController';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10), // 10MB default
  },
});

/**
 * POST /databases
 * Upload database SQL script
 */
router.post(
  '/',
  upload.single('sql_file'),
  validateRequest([
    body('name').isString().notEmpty().withMessage('Name is required'),
  ]),
  databaseController.uploadDatabase
);

/**
 * GET /databases/:databaseId
 * Get database metadata
 */
router.get(
  '/:databaseId',
  validateRequest([
    param('databaseId').isString().notEmpty(),
  ]),
  databaseController.getDatabaseById
);

export default router;
