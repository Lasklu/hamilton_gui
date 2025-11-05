import { Router } from 'express';
import databaseRoutes from './databases';
import clusteringRoutes from './clustering';
import ontologyRoutes from './ontology';

const router = Router();

// Mount route modules
router.use('/databases', databaseRoutes);
router.use('/databases', clusteringRoutes);
router.use('/ontology', ontologyRoutes);

export default router;
