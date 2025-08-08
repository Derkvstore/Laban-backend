const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const specialOrdersController = require('../controllers/special_orders.controller');

// Toutes les routes pour les commandes spéciales sont protégées
router.use(authMiddleware);

// Routes CRUD pour les commandes spéciales
router.post('/', specialOrdersController.createSpecialOrder);
router.get('/', specialOrdersController.getAllSpecialOrders);
router.get('/:id', specialOrdersController.getSpecialOrderById);
router.put('/:id', specialOrdersController.updateSpecialOrder);
router.delete('/:id', specialOrdersController.deleteSpecialOrder);

module.exports = router;
