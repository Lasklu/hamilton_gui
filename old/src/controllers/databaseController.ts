import { Request, Response, NextFunction } from 'express';
import * as databaseService from '../services/databaseService';
import { logger } from '../utils/logger';

/**
 * Upload database SQL script
 * POST /databases
 */
export const uploadDatabase = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name } = req.body;
    const file = req.file;
    const rawSql = req.body.sql_script; // For text/plain content type

    logger.info('Upload database request', { name, hasFile: !!file, hasRawSql: !!rawSql });

    // TODO: Implement database upload logic
    const database = await databaseService.uploadDatabase(name, file, rawSql);

    res.status(201).json(database);
  } catch (error) {
    next(error);
  }
};

/**
 * Get database metadata by ID
 * GET /databases/:databaseId
 */
export const getDatabaseById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { databaseId } = req.params;

    logger.info('Get database request', { databaseId });

    // TODO: Implement get database logic
    const database = await databaseService.getDatabaseById(databaseId);

    res.status(200).json(database);
  } catch (error) {
    next(error);
  }
};
