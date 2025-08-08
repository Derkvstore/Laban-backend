const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const rapportsController = require('../controllers/rapports.controller');

// Toutes les routes pour les rapports sont protégées
router.use(authMiddleware);

// Route GET pour générer un rapport de la journée
router.get('/daily', rapportsController.getDailyReport);

// Nouvelle route GET pour récupérer les totaux du tableau de bord
router.get('/totals', rapportsController.getDashboardTotals);

module.exports = router;
