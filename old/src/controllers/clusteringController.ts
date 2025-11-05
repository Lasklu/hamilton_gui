import { Request, Response, NextFunction } from 'express';
import * as clusteringService from '../services/clusteringService';
import { logger } from '../utils/logger';

/**
 * Suggest clusters (groups of tables)
 * POST /databases/:databaseId/cluster
 */
export const suggestClusters = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { databaseId } = req.params;
    const { applyFinetuning = false } = req.body;

    logger.info('Suggest clusters request', { databaseId, applyFinetuning });

    // TODO: Implement clustering logic
    const suggestions = await clusteringService.suggestClusters(databaseId, applyFinetuning);

    res.status(200).json(suggestions);
  } catch (error) {
    next(error);
  }
};
