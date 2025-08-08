const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const defectiveReturnsController = require('../controllers/defective_returns.controller');

// Toutes les routes pour les retours défectueux sont protégées
router.use(authMiddleware);

// Route GET pour récupérer tous les retours défectueux
router.get('/', defectiveReturnsController.getAllDefectiveReturns);

module.exports = router;
