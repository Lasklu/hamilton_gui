import { Router } from 'express';
import { param, body } from 'express-validator';
import { validateRequest } from '../middleware/validateRequest';
import * as clusteringController from '../controllers/clusteringController';

const router = Router();

/**
 * POST /databases/:databaseId/cluster
 * Suggest clusters (groups of tables)
 */
router.post(
  '/:databaseId/cluster',
  validateRequest([
    param('databaseId').isString().notEmpty(),
    body('applyFinetuning').optional().isBoolean(),
  ]),
  clusteringController.suggestClusters
);

export default router;
