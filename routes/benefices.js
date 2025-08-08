const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const beneficesController = require('../controllers/benefices.controller');

// Toutes les routes pour les bénéfices sont protégées
router.use(authMiddleware);

// Route GET pour calculer les bénéfices
router.get('/', beneficesController.getBenefices);

module.exports = router;
