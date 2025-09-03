const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const facturesController = require('../controllers/factures.controller');

// toutes les routes facture nécessitent auth
router.use(authMiddleware);

// Lister toutes les factures
router.get('/', facturesController.listerFactures);

// Créer une facture (génère aussi la vente et les items)
router.post('/creer', facturesController.creerFacture);

// Lire une facture (détails)
router.get('/:id', facturesController.obtenirFacture);

// Générer le PDF (Puppeteer)
router.get('/:id/pdf', facturesController.genererPDF);

// Gérer un paiement sur facture (ajout d’un montant)
router.put('/:id/paiement', facturesController.payerFacture);

// Annuler une facture (restock de tous les mobiles liés)
router.put('/:id/annuler', facturesController.annulerFacture);

module.exports = router;
