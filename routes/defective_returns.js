const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const defectiveReturnsController = require('../controllers/defective_returns.controller');

// Toutes les routes ci-dessous sont protégées
router.use(authMiddleware);

// GET /api/returns  → liste des retours (alias principal attendu par le frontend)
router.get('/', defectiveReturnsController.getAllDefectiveReturns);

module.exports = router;
