const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const ventesController = require('../controllers/ventes.controller');

// Toutes les routes définies ci-dessous utiliseront le middleware d'authentification.
router.use(authMiddleware);

// Nouvelle route GET pour récupérer toutes les ventes
router.get('/', ventesController.getAllVentes);

// Route POST pour créer une nouvelle vente
router.post('/', ventesController.createVente);

// Route PUT pour annuler un produit d'une vente
router.put('/cancel-item', ventesController.cancelVenteItem);

// Route PUT pour enregistrer un paiement
router.put('/payment', ventesController.makePayment);

// Route POST pour enregistrer le retour d'un produit défectueux
router.post('/return-defective', ventesController.returnDefectiveProduct);

module.exports = router;
