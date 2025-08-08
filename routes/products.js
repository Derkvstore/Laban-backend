const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const productsController = require('../controllers/products.controller');

// Applique le middleware d'authentification pour toutes les routes des produits
router.use(authMiddleware);

// Routes CRUD pour les produits
router.post('/', productsController.createProduct);
router.get('/', productsController.getAllProducts);
router.get('/:id', productsController.getProductById);
router.put('/:id', productsController.updateProduct);
router.delete('/:id', productsController.deleteProduct);

module.exports = router;
