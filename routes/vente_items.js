const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const venteItemsController = require('../controllers/vente_items.controller');

// Toutes les routes pour les articles de vente sont protégées
router.use(authMiddleware);

// Route GET pour récupérer tous les articles de vente
router.get('/', venteItemsController.getAllVenteItems);

// Route GET pour récupérer les articles de vente par ID de vente
router.get('/vente/:venteId', venteItemsController.getVenteItemsByVenteId);

// Route PUT pour mettre à jour un article de vente
router.put('/:id', venteItemsController.updateVenteItem);

module.exports = router;
