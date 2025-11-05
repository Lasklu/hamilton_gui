import { Router } from 'express';
import { body, query } from 'express-validator';
import { validateRequest } from '../middleware/validateRequest';
import * as ontologyController from '../controllers/ontologyController';

const router = Router();

/**
 * POST /ontology/concepts
 * Generate ontology concepts for given tables
 */
router.post(
  '/concepts',
  validateRequest([
    query('samples').optional().isInt({ min: 1, max: 50 }),
    body('databaseId').isString().notEmpty(),
    body('tables').isArray({ min: 1 }),
    body('tables.*.schema').isString().notEmpty(),
    body('tables.*.name').isString().notEmpty(),
    body('modelingHints').optional().isObject(),
  ]),
  ontologyController.generateConcepts
);

/**
 * POST /ontology/attributes
 * Generate/augment attributes for a given concept and tables
 */
router.post(
  '/attributes',
  validateRequest([
    query('samples').optional().isInt({ min: 1, max: 50 }),
    body('databaseId').isString().notEmpty(),
    body('tables').isArray({ min: 1 }),
    body('tables.*.schema').isString().notEmpty(),
    body('tables.*.name').isString().notEmpty(),
    body('concept').isObject(),
    body('modelingHints').optional().isObject(),
  ]),
  ontologyController.generateAttributes
);

/**
 * POST /ontology/relationships
 * Generate ALL relationships (object properties) for given concepts & attributes
 */
router.post(
  '/relationships',
  validateRequest([
    query('samples').optional().isInt({ min: 1, max: 50 }),
    body('databaseId').isString().notEmpty(),
    body('tables').isArray({ min: 1 }),
    body('tables.*.schema').isString().notEmpty(),
    body('tables.*.name').isString().notEmpty(),
    body('concepts').isArray({ min: 2 }),
    body('attributes').isArray(),
    body('modelingHints').optional().isObject(),
  ]),
  ontologyController.generateRelationships
);

export default router;
