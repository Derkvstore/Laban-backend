const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const facturesController = require('../controllers/factures.controller');

// Toutes les routes protégées
router.use(authMiddleware);

// Créer une facture (crée aussi la vente + lignes + met à jour le stock)
router.post('/creer', facturesController.creerFacture);

// Récupérer la facture (détail complet)
router.get('/:id', facturesController.obtenirFacture);

// Générer et télécharger le PDF de la facture
router.get('/:id/pdf', facturesController.genererPDF);

module.exports = router;
