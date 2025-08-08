const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const rapportsController = require('../controllers/rapports.controller');

// Toutes les routes pour les rapports sont protégées
router.use(authMiddleware);

// Route GET pour générer un rapport de la journée
// Un paramètre de requête `?date=YYYY-MM-DD` peut être utilisé pour choisir une date spécifique
router.get('/daily', rapportsController.getDailyReport);

module.exports = router;
