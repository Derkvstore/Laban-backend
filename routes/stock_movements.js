const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const stockMovementsController = require('../controllers/stock_movements.controller');

// Applique le middleware d'authentification pour toutes les routes
router.use(authMiddleware);

// Route GET pour récupérer tous les mouvements de stock
router.get('/', stockMovementsController.getAllStockMovements);

// Route GET pour récupérer les mouvements de stock d'un produit spécifique
router.get('/product/:productId', stockMovementsController.getStockMovementsByProduct);

module.exports = router;
