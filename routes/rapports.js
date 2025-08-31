const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const rapportsController = require('../controllers/rapports.controller');

// Toutes les routes ci-dessous sont protégées
router.use(authMiddleware);

// Rapport “cartes + inventaire”
router.get('/daily', rapportsController.getDailyReport);

// Totaux dashboard
router.get('/totals', rapportsController.getDashboardTotals);

// ✅ NOUVEAU : Rapport journalier par produit (table détaillée)
router.get('/rapport-journalier-produits', rapportsController.getRapportJournalierProduits);

module.exports = router;
